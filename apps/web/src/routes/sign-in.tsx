import { useState } from "react";
import { useSignIn } from "../auth/useAuth";

/** US2 AC1/AC4: shown when signed out; one failure message either way (FR-009). */
export function SignInView() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useSignIn();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        signIn.mutate({ username, password });
      }}
    >
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
      <button type="submit" disabled={signIn.isPending}>
        Sign in
      </button>
      {signIn.isError && <p role="alert">Invalid username or password.</p>}
    </form>
  );
}
