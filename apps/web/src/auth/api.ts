/** Sign-in, sign-out, and `me` — thin fetch wrappers over contracts/http-auth.md. */

export interface User {
  id: string;
  displayName: string;
  role: string;
}

interface UserResponse {
  user: User;
}

/**
 * `GET /auth/me` — the ONLY source of identity truth (spec D3, FR-007).
 * `401` means "signed out", not an error: it's the answer AC1 asks for.
 */
export async function fetchMe(): Promise<User | null> {
  const res = await fetch("/auth/me", { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed: ${res.status}`);
  const body = (await res.json()) as UserResponse;
  return body.user;
}

/**
 * A failed sign-in throws one message that doesn't disclose whether the
 * account exists (FR-009) — the server already returns identical 401s for
 * both cases, so no branching here would even be possible.
 */
export async function signIn(
  username: string,
  password: string,
): Promise<User> {
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
