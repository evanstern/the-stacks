import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import {
  AuthRequestError,
  type RedeemInput,
  redeemInvitation,
  signIn,
} from "./auth";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

const INVALID_TOKEN =
  "This invitation is invalid, expired, or already redeemed.";
const GENERIC = "Something went wrong. Try again.";

export type RedeemResult = { ok: true } | { ok: false; messages: string[] };

/** Redeem an invitation; the token is trimmed and never enters a URL. */
export async function submitRedeem(
  input: RedeemInput,
  onSignedIn: () => void,
): Promise<RedeemResult> {
  try {
    await redeemInvitation({ ...input, token: input.token.trim() });
  } catch (err) {
    if (err instanceof AuthRequestError) {
      if (err.status === 409) {
        return { ok: false, messages: ["That username is already taken."] };
      }
      if (err.status === 400 && err.issues.length > 0) {
        if (err.issues.some((issue) => issue.path === "token")) {
          return { ok: false, messages: [INVALID_TOKEN] };
        }
        return { ok: false, messages: err.issues.map((i) => i.message) };
      }
    }
    return { ok: false, messages: [GENERIC] };
  }
  onSignedIn();
  return { ok: true };
}

/** US2 AC1/AC4: shown when signed out; revalidates the root loader on sign-in. */
export function SignIn() {
  const revalidator = useRevalidator();
  return <SignInCard onSignedIn={() => revalidator.revalidate()} />;
}

export function SignInCard({
  onSignedIn,
  initialMode = "signin",
}: {
  onSignedIn: () => void;
  initialMode?: "signin" | "redeem";
}) {
  const [mode, setMode] = useState<"signin" | "redeem">(initialMode);
  // D10: disabled until mounted, so a pre-hydration submit can't send the
  // password in a GET query string (FR-014).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mode === "signin" ? (
    <SignInForm
      mounted={mounted}
      onSignedIn={onSignedIn}
      onRedeem={() => setMode("redeem")}
    />
  ) : (
    <RedeemForm
      mounted={mounted}
      onSignedIn={onSignedIn}
      onBack={() => setMode("signin")}
    />
  );
}

function RedeemForm({
  mounted,
  onSignedIn,
  onBack,
}: {
  mounted: boolean;
  onSignedIn: () => void;
  onBack: () => void;
}) {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessages([]);
    const result = await submitRedeem(
      { token, username, displayName, password },
      onSignedIn,
    );
    if (!result.ok) setMessages(result.messages);
    setPending(false);
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm">
      <CardHeader>
        <CardTitle>Redeem an invitation</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-token">Invitation token</Label>
            <Input
              id="invite-token"
              value={token}
              autoComplete="off"
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-username">Username</Label>
            <Input
              id="invite-username"
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-display-name">Display name</Label>
            <Input
              id="invite-display-name"
              value={displayName}
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-password">Password</Label>
            <Input
              id="invite-password"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!mounted || pending}>
            Create account
          </Button>
          <Button type="button" variant="ghost" onClick={onBack}>
            Back to sign in
          </Button>
          {messages.map((message) => (
            <p key={message} role="alert">
              {message}
            </p>
          ))}
        </form>
      </CardContent>
    </Card>
  );
}

function SignInForm({
  mounted,
  onSignedIn,
  onRedeem,
}: {
  mounted: boolean;
  onSignedIn: () => void;
  onRedeem: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    try {
      await signIn(username, password);
      onSignedIn();
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
          <Button type="button" variant="ghost" onClick={onRedeem}>
            Have an invitation?
          </Button>
          {failed && <p role="alert">Invalid username or password.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
