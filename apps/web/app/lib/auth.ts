import { redirect } from "react-router";

import { getAuthStatus, getOrCreateSession, isApiNetworkError, isUnauthorized } from "./api";

export async function requireAuth() {
  try {
    await getAuthStatus();
  } catch (error) {
    if (isUnauthorized(error) || isApiNetworkError(error)) {
      throw redirect("/login");
    }
    throw error;
  }
}

export async function redirectToSession() {
  await requireAuth();
  const session = await getOrCreateSession();
  throw redirect(`/chat/${session.id}`);
}
