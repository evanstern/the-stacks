import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import { signIn } from "./auth";

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
    <form method="post" onSubmit={handleSubmit}>
      <h1>Sign in</h1>
      <p>
        <label>
          Username
          <br />
          <input
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
      </p>
      <p>
        <label>
          Password
          <br />
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </p>
      <button type="submit" disabled={!mounted || pending}>
        Sign in
      </button>
      {failed && <p role="alert">Invalid username or password.</p>}
    </form>
  );
}
