import { createHmac, timingSafeEqual } from "node:crypto";

const AUTH_COOKIE_NAME = "ikis_auth";
const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AUTH_MAX_AGE_MS = AUTH_MAX_AGE_SECONDS * 1000;

export type AuthMode = {
  enabled: boolean;
  label: string;
  description: string;
};

function getAuthSecret(): string {
  const secret = process.env.IKIS_AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "IKIS_AUTH_SECRET is required for signed auth cookies. Generate one with `openssl rand -hex 32` and set it before starting Ikis.",
    );
  }

  return secret;
}

function getSharedPassword(): string {
  const password = process.env.IKIS_SHARED_PASSWORD;

  if (!password) {
    throw new Error(
      "IKIS_SHARED_PASSWORD is required for self-hosted shared-password auth. Set it before starting Ikis.",
    );
  }

  return password;
}

function hmacHex(message: string): string {
  return createHmac("sha256", getAuthSecret()).update(message).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let bufA: Buffer;
  let bufB: Buffer;

  try {
    bufA = Buffer.from(a, "hex");
    bufB = Buffer.from(b, "hex");
  } catch {
    return false;
  }

  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function cookieSecurityAttribute(): string {
  if (process.env.NODE_ENV !== "production") return "";
  return process.env.PUBLIC_URL?.startsWith("http://") ? "" : "; Secure";
}

function readAuthCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    if (trimmed.slice(0, eq) === AUTH_COOKIE_NAME) {
      return trimmed.slice(eq + 1);
    }
  }

  return undefined;
}

export function assertAuthConfigured(): void {
  getSharedPassword();
  getAuthSecret();
}

export function getAuthMode(): AuthMode {
  assertAuthConfigured();

  return {
    enabled: true,
    label: "Shared password enabled",
    description:
      "Ikis is protected by a single-owner password gate and HMAC-signed HttpOnly cookie.",
  };
}

export function signAuthCookie(now = Date.now()): string {
  const issuedAt = String(now);
  return `${issuedAt}.${hmacHex(issuedAt)}`;
}

export function verifyAuthCookie(value: string | undefined): boolean {
  if (!value) return false;

  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return false;

  const issuedAtStr = value.slice(0, dot);
  const mac = value.slice(dot + 1);

  if (!/^\d+$/.test(issuedAtStr)) return false;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > AUTH_MAX_AGE_MS) return false;
  if (!/^[0-9a-f]+$/i.test(mac)) return false;

  return safeEqualHex(hmacHex(issuedAtStr), mac);
}

export function buildAuthCookieHeader(value: string): string {
  return `${AUTH_COOKIE_NAME}=${value}; HttpOnly${cookieSecurityAttribute()}; SameSite=Strict; Path=/; Max-Age=${AUTH_MAX_AGE_SECONDS}`;
}

export function buildClearAuthCookieHeader(): string {
  return `${AUTH_COOKIE_NAME}=; HttpOnly${cookieSecurityAttribute()}; SameSite=Strict; Path=/; Max-Age=0`;
}

export function verifySharedPassword(password: FormDataEntryValue | null): boolean {
  const submitted = typeof password === "string" ? password : "";
  const expected = getSharedPassword();
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);

  if (submittedBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(submittedBuffer, submittedBuffer);
    return false;
  }

  return timingSafeEqual(submittedBuffer, expectedBuffer);
}

export function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function requireAuthenticated(request: Request, opts: { api?: boolean } = {}): void {
  assertAuthConfigured();

  if (verifyAuthCookie(readAuthCookie(request))) return;

  if (opts.api) {
    throw new Response("unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const next = encodeURIComponent(`${url.pathname}${url.search}`);

  throw new Response(null, {
    status: 302,
    headers: { Location: `/login?next=${next}` },
  });
}
