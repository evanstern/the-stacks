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
