/** Sign-in and sign-out — thin fetch wrappers over contracts/http-auth.md. */

import type { PublicUser } from "@the-stacks/shared";

interface UserResponse {
  user: PublicUser;
}

/**
 * A failed sign-in throws one message that doesn't disclose whether the
 * account exists (FR-009) — the server already returns identical 401s for
 * both cases, so no branching here would even be possible.
 */
export async function signIn(
  username: string,
  password: string,
): Promise<PublicUser> {
  const res = await fetch("/auth/sign-in", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error("Invalid username or password.");
  }
  const body = (await res.json()) as UserResponse;
  return body.user;
}

export async function signOut(): Promise<void> {
  await fetch("/auth/sign-out", { method: "POST", credentials: "same-origin" });
}

/** A failed auth call: carries the HTTP status and the error-contract issues. */
export class AuthRequestError extends Error {
  readonly status: number;
  readonly issues: { path: string; message: string }[];
  constructor(
    status: number,
    issues: { path: string; message: string }[] = [],
    message = "Request failed.",
  ) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.issues = issues;
  }
}

async function failure(res: Response): Promise<AuthRequestError> {
  let issues: { path: string; message: string }[] = [];
  let message = "Request failed.";
  try {
    const body = (await res.json()) as {
      error?: {
        message?: string;
        issues?: { path: string; message: string }[];
      };
    };
    issues = body.error?.issues ?? [];
    message = body.error?.message ?? message;
  } catch {
    // Non-JSON body: status alone carries the meaning.
  }
  return new AuthRequestError(res.status, issues, message);
}

export interface RedeemInput {
  token: string;
  username: string;
  displayName: string;
  password: string;
}

/** POST /auth/invitations/redeem. The server sets the session cookie on 201. */
export async function redeemInvitation(
  input: RedeemInput,
): Promise<PublicUser> {
  const res = await fetch("/auth/invitations/redeem", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as UserResponse).user;
}

export interface IssuedInvitation {
  token: string;
  expiresAt: string;
}

/** POST /auth/invitations (operator only). The raw token comes back once. */
export async function issueInvitation(
  expiresInDays: number,
): Promise<IssuedInvitation> {
  const res = await fetch("/auth/invitations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresInDays }),
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as IssuedInvitation;
}
