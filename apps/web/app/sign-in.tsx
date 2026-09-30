import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import { signIn } from "./auth";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

/** US2 AC1/AC4: shown when signed out; one failure message either way (FR-009). */
export function SignIn() {
  const revalidator = useRevalidator();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // D10: disabled until mounted, so a pre-hydration submit can't send the
  // password in a GET query string (FR-014).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    try {
      await signIn(username, password);
      revalidator.revalidate();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!mounted || pending}>
            Sign in
          </Button>
          {failed && <p role="alert">Invalid username or password.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
