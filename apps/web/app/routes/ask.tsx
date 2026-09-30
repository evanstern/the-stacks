import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

// Placeholder for Phase 3 (T034: conversation, prompt bar, Sources panel,
// citations). Phase 1 only needs a route that renders inside the shell.
export default function Ask() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  return (
    <div className="p-4">
      <h1 className="mb-2 text-lg font-semibold">Ask</h1>
      <p>
        Signed in as <strong>{root?.user?.displayName}</strong>
      </p>
    </div>
  );
}
