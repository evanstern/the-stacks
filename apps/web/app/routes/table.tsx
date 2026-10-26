import { useEffect, useState } from "react";
import { Link, useNavigate, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The Table landing (plan D14, FR-005): start a fresh table (a random id)
 * or join one by pasting its link or id. Client-only — `crypto.randomUUID`
 * needs the browser, so Start stays disabled until hydration.
 */
export default function Table() {
  const navigate = useNavigate();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const [mounted, setMounted] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    const match = joinValue.match(UUID_RE);
    if (!match) {
      setJoinError("Enter a table link or id.");
      return;
    }
    setJoinError(null);
    navigate(`/play/${match[0]}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Table</h1>

      <button
        type="button"
        onClick={() => navigate(`/play/${crypto.randomUUID()}`)}
        disabled={!mounted}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Start a new table
      </button>

      <form onSubmit={handleJoin} className="flex flex-col gap-2">
        <label htmlFor="join-table" className="text-sm font-medium">
          Join a table
        </label>
        <div className="flex gap-2">
          <input
            id="join-table"
            value={joinValue}
            onChange={(event) => setJoinValue(event.target.value)}
            placeholder="Paste a table link or id"
            className="h-10 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Join
          </button>
        </div>
        {joinError && (
          <p role="alert" className="text-sm text-destructive">
            {joinError}
          </p>
        )}
      </form>

      {root?.user?.role === "operator" && (
        <Link
          to="/play/fixtures"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Preview fixtures
        </Link>
      )}
    </div>
  );
}
