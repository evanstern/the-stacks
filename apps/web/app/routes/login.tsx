import { Form, redirect, useActionData, useNavigation } from "react-router";
import { LibraryBig } from "lucide-react";

import { getAuthStatus, getOrCreateSession, isApiNetworkError, isUnauthorized, login } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LoginActionData = {
  error: string;
};

export async function loginLoader() {
  try {
    await getAuthStatus();
    const session = await getOrCreateSession();
    throw redirect(`/chat/${session.id}`);
  } catch (error) {
    if (isUnauthorized(error) || isApiNetworkError(error)) {
      return null;
    }
    throw error;
  }
}

export async function loginAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  try {
    await login(password);
    const session = await getOrCreateSession();
    throw redirect(`/chat/${session.id}`);
  } catch (error) {
    if (isUnauthorized(error)) {
      return { error: "That password did not open the archive." } satisfies LoginActionData;
    }
    if (isApiNetworkError(error)) {
      return { error: "The archive API could not complete login. Check the server configuration and try again." } satisfies LoginActionData;
    }
    throw error;
  }
}

export function LoginRoute() {
  const actionData = useActionData() as LoginActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="login-page">
      <Card className="login-card">
        <div className="login-lockup" style={{ marginBottom: "2rem" }}>
          <span className="icon-mark" style={{ width: "2.75rem", height: "2.75rem" }}>
            <LibraryBig className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="micro-label text-muted">Keeper access</p>
            <h1 className="font-serif text-3xl tracking-[-0.04em] text-foreground">The Stacks</h1>
          </div>
        </div>

        <p className="micro-label mb-4 text-clay-dark">Private archive</p>
        <h2 className="font-serif text-4xl tracking-[-0.05em] text-foreground">Open the command desk.</h2>
        <p className="text-muted" style={{ marginTop: "1rem", fontSize: "0.92rem", lineHeight: 1.7 }}>
          Sign in with the admin password to continue into the chat-first campaign workspace.
        </p>

        <Form method="post" className="login-form">
          <label className="field-label" htmlFor="password">
            <span className="micro-label mb-2 block text-muted">Admin password</span>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter archive key"
              required
            />
          </label>
          {actionData?.error ? (
            <p className="login-error" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Opening" : "Enter archive"}
          </Button>
        </Form>
      </Card>
    </main>
  );
}
