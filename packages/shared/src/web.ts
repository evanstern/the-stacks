/** The two roles session-auth (spec 005) defines: operator or invited player. */
export type Role = "operator" | "player";

/** The user-facing identity shape returned by sign-in, /auth/me, and the load context (plan D3). */
export interface PublicUser {
  id: string;
  displayName: string;
  role: Role;
}

/** JobStatus from specs/017-ingestion-pipeline/contracts/http-ingest.md, restated (plan D2). */
export interface LibraryJob {
  id: string;
  book: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: "extract" | "parse" | "store" | "embed" | null;
  format: "zip" | "html" | "markdown";
  filename: string;
  bytes: number;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  result: LibraryJobResult | null;
  error: string | null;
}

/** Only the fields the UI reads; the server's full JobResult is assignable to this. */
export interface LibraryJobResult {
  documentId: string;
  chunkCount: number;
  pages: number;
  embedding:
    | { status: "embedded"; model: string; count: number }
    | { status: "skipped"; reason: string };
}

/** Per-request server data offered to React Router loaders (doc-0003 ruling 5). */
export interface StacksLoadContext {
  identity(): Promise<PublicUser | null>;
  /** Newest 100 jobs, as GET /library/jobs?limit=100 returns them. null unless the caller is an operator (plan D2). */
  jobs(): Promise<LibraryJob[] | null>;
}

/** The web server bundle's entry; Hono calls it with c.req.raw (plan D4, D5). */
export type WebRequestHandler = (
  request: Request,
  context: StacksLoadContext,
) => Promise<Response>;
