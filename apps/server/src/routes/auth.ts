import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ZodError } from "zod";
import { z } from "zod";
import { issueInvitation, redeemInvitation } from "../auth/invitations.js";
import type { AuthVariables } from "../auth/middleware.js";
import {
  createAuthMiddleware,
  SESSION_COOKIE_NAME,
} from "../auth/middleware.js";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "../auth/password.js";
import type { DbClient, ValidateSession } from "../auth/session.js";
import { createSession, endSession } from "../auth/session.js";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../errors.js";
import { users } from "../schema/auth.js";

/** Sign-in, sign-out, `me`, and invitations (contracts/http-auth.md). */

const SignInSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

const IssueInvitationSchema = z.object({
  expiresInDays: z.number().int().positive().optional(),
});

const RedeemInvitationSchema = z.object({
  token: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

// A fixed, precomputed hash (never any real account's) verified when no
// user is found (T017), so sign-in's response time doesn't distinguish
// "unknown username" from "wrong password" — a fast "no such user" leaks
// the account list as surely as a different message would.
const DUMMY_PASSWORD_HASH =
  "scrypt1$32768$8$1$tQyEm3B1AQT5UFGML+Sp6g==$XzScciO9OyCrBh241tHbskbJn9WSBBW0mueCGShQVOZUUvUztODA90GAk6MAWUIYJI/COf1lrcRKotnQMjlSOw==";

const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function toIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

async function parseJsonBody<T>(
  c: { req: { json(): Promise<unknown> } },
  schema: z.ZodType<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw new ValidationError([
      { path: "(root)", message: "Request body must be valid JSON." },
    ]);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(toIssues(parsed.error));
  }
  return parsed.data;
}

/**
 * Like `parseJsonBody`, but an empty body parses as `{}` — for
 * `POST /invitations`, whose body is entirely optional
 * (contracts/http-auth.md: `{ expiresInDays?: number }`) and whose
 * documented `curl` call (quickstart.md step 6) sends none at all.
 */
async function parseOptionalJsonBody<T>(
  c: { req: { text(): Promise<string> } },
  schema: z.ZodType<T>,
): Promise<T> {
  const text = await c.req.text();
  let json: unknown = {};
  if (text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ValidationError([
        { path: "(root)", message: "Request body must be valid JSON." },
      ]);
    }
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(toIssues(parsed.error));
  }
  return parsed.data;
}

function publicUser(user: typeof users.$inferSelect) {
  return { id: user.id, displayName: user.displayName, role: user.role };
}

/**
 * `Secure` only when the request itself arrived over HTTPS (research D4):
 * an unconditional `Secure` cookie is silently never stored on a
 * self-hoster's first `http://localhost` run.
 *
 * ponytail: reads the connection's own scheme, not `x-forwarded-proto` —
 * correct for the docker-compose default (app reached directly) but not
 * for a TLS-terminating reverse proxy in front of plain HTTP. Add
 * forwarded-proto trust when self-hosting behind a proxy is supported.
 */
function isHttps(c: { req: { url: string } }): boolean {
  return new URL(c.req.url).protocol === "https:";
}

/** Shared by sign-in and invitation redemption — both sign the caller in. */
function setSessionCookie(
  c: Context<{ Variables: AuthVariables }>,
  token: string,
) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    secure: isHttps(c),
  });
}

export interface CreateAuthRoutesOptions {
  db: DbClient;
  validateSession: ValidateSession;
}

export function createAuthRoutes({
  db,
  validateSession,
}: CreateAuthRoutesOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();
  const authMiddleware = createAuthMiddleware(validateSession);

  route.post("/sign-in", async (c) => {
    const input = await parseJsonBody(c, SignInSchema);
    const usernameNormalized = input.username.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${usernameNormalized}`)
      .limit(1);

    // Verify a hash even when no user is found (T017) — see
    // DUMMY_PASSWORD_HASH above.
    const passwordOk = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordOk) {
      throw new UnauthorizedError("Invalid username or password.");
    }

    const session = await createSession(db, user.id);
    setSessionCookie(c, session.token);

    return c.json({ user: publicUser(user) });
  });

  route.post("/sign-out", async (c) => {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    // Idempotent (contracts/http-auth.md): ending a session that's already
    // gone — or a cookie that was never valid — is still a success.
    if (token) {
      await endSession(db, token);
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.body(null, 204);
  });

  route.get("/me", authMiddleware, async (c) => {
    const identity = c.get("identity");
    if (!identity) {
      throw new UnauthorizedError();
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1);
    // The session outlived its user (deleted between sign-in and this
    // request) — treat exactly like no session at all.
    if (!user) {
      throw new UnauthorizedError();
    }
    return c.json({ user: publicUser(user) });
  });

  route.post("/invitations", authMiddleware, async (c) => {
    const identity = c.get("identity");
    if (!identity) {
      throw new UnauthorizedError();
    }
    // Operator-only (FR-012). A player is authenticated but not
    // permitted — 403, not 401 (contracts/http-auth.md).
    if (identity.role !== "operator") {
      throw new ForbiddenError("Only the operator can create invitations.");
    }
    const input = await parseOptionalJsonBody(c, IssueInvitationSchema);
    const invitation = await issueInvitation(db, identity.userId, input);
    return c.json(
      {
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      201,
    );
  });

  route.post("/invitations/redeem", async (c) => {
    const input = await parseJsonBody(c, RedeemInvitationSchema);
    const result = await redeemInvitation(db, input);

    if (!result.ok) {
      if (result.reason === "conflict") {
        throw new ConflictError("That username is already taken.");
      }
      // Unknown, expired, or already redeemed — deliberately
      // indistinguishable (FR-013, contracts/http-auth.md).
      throw new ValidationError([
        {
          path: "token",
          message: "This invitation is invalid, expired, or already redeemed.",
        },
      ]);
    }

    const session = await createSession(db, result.user.id);
    setSessionCookie(c, session.token);
    return c.json({ user: publicUser(result.user) }, 201);
  });

  return route;
}
