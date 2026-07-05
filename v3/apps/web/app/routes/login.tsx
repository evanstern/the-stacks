import { Form, redirect, useActionData } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { isAuthenticated, login } from "~/lib/api.server";
import type { Route } from "./+types/login";

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthenticated(request)) {
    throw redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  const response = await login(request, password);

  if (response.status !== 200) {
    return { error: "Sign-in failed." };
  }

  const headers = new Headers();
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    headers.set("set-cookie", setCookie);
  }
  throw redirect("/", { headers });
}

export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Form method="post" className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <Input id="password" name="password" type="password" required autoFocus />
        {actionData?.error ? (
          <p role="alert" className="text-sm text-[hsl(var(--destructive))]">
            {actionData.error}
          </p>
        ) : null}
        <Button type="submit">Sign in</Button>
      </Form>
    </main>
  );
}
