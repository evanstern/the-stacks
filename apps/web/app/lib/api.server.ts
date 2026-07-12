/**
 * The web→api seam: the ONLY module that talks to the API service.
 *
 * Doctrine (FR-019, research R9; endpoint shapes in
 * specs/007-v3-skeleton/contracts/api.md): the browser never calls the API.
 * Routes call these helpers from server-side loaders/actions, which reach the
 * API over the compose-internal network. In prod compose only the web port is
 * published, so the browser physically cannot hit the API even by accident.
 * The `.server.ts` suffix makes RR7 strip this file from the client bundle,
 * enforcing the seam at build time too.
 *
 * Auth model: the API is the sole auth authority. Web treats the session
 * cookie as an opaque sealed/HttpOnly token — it relays it onward on every
 * call and never inspects or mints it. Login/logout actions relay Set-Cookie
 * from the API's response back onto their redirect.
 */
function apiBaseUrl(): string {
  // Resolved per-call (not at module load) so tests can swap the env var.
  // "http://api:4401" is the compose-internal service address.
  return process.env.API_INTERNAL_URL ?? "http://api:4401";
}

/**
 * The browser never calls the API directly (FR-019, research R9) — this is
 * the one place `web` reaches across the seam, relaying the incoming
 * request's session cookie onward and letting callers relay Set-Cookie back.
 */
export async function apiFetch(request: Request, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  // Forward the browser's cookie header verbatim — the API validates the
  // sealed session; web never parses it.
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  // String bodies are JSON by convention; default the header so callers can
  // just pass JSON.stringify(...). FormData bodies (008 uploads) must NOT be
  // touched — fetch mints the multipart boundary itself, and a preset
  // content-type would break it.
  if (typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
}

// Returns the raw Response (not a boolean) because the caller must relay the
// API's Set-Cookie header onto its redirect — see routes/login.tsx.
export async function login(request: Request, password: string): Promise<Response> {
  return apiFetch(request, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// Raw Response for the same reason as login(): logout's Set-Cookie clears
// the session and must ride the redirect back to the browser.
export async function logout(request: Request): Promise<Response> {
  return apiFetch(request, "/api/auth/logout", { method: "POST" });
}

// The session check behind all auth gating (protected-layout loader, login
// bounce). Any non-200 — expired, invalid, or API down — reads as signed out.
export async function isAuthenticated(request: Request): Promise<boolean> {
  const response = await apiFetch(request, "/api/auth/session");
  return response.status === 200;
}

// Shapes below mirror the wire contract in specs/007-v3-skeleton/contracts/
// api.md. If the API changes, update both — web has no generated client.
export interface RunSummary {
  id: string;
  status: "accepted" | "running" | "succeeded" | "failed";
  createdAt: string;
  completedAt: string | null;
}

// One entry in the append-only six-seam event trail a skeleton-check run
// emits as it exercises each infrastructure seam.
export interface RunEvent {
  seam: string;
  ok: boolean;
  durationMs: number | null;
  detail: Record<string, unknown>;
  at: string;
}

export interface RunDetail extends RunSummary {
  startedAt: string | null;
  // Typed failure outcome — present only on failed runs; identifies which
  // seam broke and the failure class, so the UI never guesses from strings.
  outcome?: { class: string; seam: string; message: string };
  // Vector identity block — present only on succeeded runs; proves the
  // embedding round-trip (write + readback distance) actually happened.
  vector?: {
    id: string;
    provider: string;
    model: string;
    dimensions: number;
    readbackDistance: number | null;
  };
  events: RunEvent[];
}

// POST /api/skeleton-checks is accept-then-async: the API returns 202 with a
// run in "accepted" status and does the work in the background. The caller
// redirects to the detail page, which polls until the run is terminal.
export async function triggerSkeletonCheck(request: Request): Promise<RunSummary> {
  const response = await apiFetch(request, "/api/skeleton-checks", { method: "POST" });
  if (!response.ok) {
    throw new Response("Failed to trigger skeleton check", { status: response.status });
  }
  const data = (await response.json()) as { run: RunSummary };
  return data.run;
}

export async function listSkeletonChecks(request: Request): Promise<RunSummary[]> {
  const response = await apiFetch(request, "/api/skeleton-checks");
  // Degrade to an empty list rather than erroring: the home page should
  // still render (and offer logout) even if the run history can't load.
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { runs: RunSummary[] };
  return data.runs;
}

// ---------------------------------------------------------------------------
// Ingestion (spec 008; wire contract: specs/008-ingestion-service/contracts/
// api.md). Upload is accept-then-async: the API answers with a claim ticket
// before any parsing happens; the ticket page watches the event trail.
// ---------------------------------------------------------------------------

export interface UploadTicket {
  ticket: { kind: "source" | "batch"; id: string };
  duplicate: boolean;
  status: string;
}

export interface UploadRejection {
  status: number;
  message: string;
}

/** Forwards the operator's multipart upload to the API. Returns the ticket on
 * 200/201, or the API's typed refusal (415 unsupported/oversized etc.) so the
 * form can show WHY — refusals are an expected outcome here, not exceptions. */
export async function uploadToLibrary(
  request: Request,
  formData: FormData,
): Promise<UploadTicket | UploadRejection> {
  const response = await apiFetch(request, "/api/uploads", { method: "POST", body: formData });
  if (response.status === 200 || response.status === 201) {
    return (await response.json()) as UploadTicket;
  }
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return {
    status: response.status,
    message: body?.error?.message ?? "Upload failed.",
  };
}

// ---------------------------------------------------------------------------
// Library listing (spec 009; wire contract: specs/009-library-surface-env/
// contracts/api.md). One newest-first page of SUBMISSIONS — standalone
// sources + batches; batch members are represented by their batch row.
// ---------------------------------------------------------------------------

interface LibraryListItemBase {
  id: string;
  originalFilename: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Standalone source row with its ingestion evidence (US3): plugin
 * attribution, generation, CURRENT-generation counts, scrubbed failure. */
export interface LibrarySourceItem extends LibraryListItemBase {
  kind: "source";
  plugin: { name: string; version: string; confidence: number } | null;
  generation: number;
  counts: { sections: number; chunks: number };
  lastError: { class: string; stage: string; message: string } | null;
}

/** Batch row; members never appear as their own rows — this summary speaks
 * for them (ingested/failed read member statuses, skipped reads the report). */
export interface LibraryBatchItem extends LibraryListItemBase {
  kind: "batch";
  entrySummary: { ingested: number; skipped: number; failed: number; total: number };
}

export type LibraryListItem = LibrarySourceItem | LibraryBatchItem;

export interface LibraryListPage {
  items: LibraryListItem[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /api/uploads — the listing behind /library. Unlike listSkeletonChecks'
 * degrade-to-empty, a failure here throws: an empty library and an unreachable
 * API must not look the same on a page whose whole job is honest inventory. */
export async function listUploads(
  request: Request,
  opts: { limit?: number; offset?: number } = {},
): Promise<LibraryListPage> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(request, `/api/uploads${query}`);
  if (!response.ok) {
    throw new Response("Failed to load the library listing", { status: response.status });
  }
  return (await response.json()) as LibraryListPage;
}

export interface IngestionEvent {
  stage: string;
  event: string;
  ok: boolean;
  detail: Record<string, unknown>;
  durationMs: number | null;
  at: string;
}

export interface SourceTicketDetail {
  ticket: { kind: "source"; id: string };
  source: {
    originalFilename: string;
    status: "queued" | "processing" | "ingested" | "failed" | "empty";
    plugin: { name: string; version: string; confidence: number } | null;
    generation: number;
    counts: { sections: number; chunks: number };
    lastError: { class: string; stage: string; message: string } | null;
  };
  events: IngestionEvent[];
}

export interface BatchTicketDetail {
  ticket: { kind: "batch"; id: string };
  batch: {
    originalFilename: string;
    status: "expanding" | "expanded" | "failed" | "empty";
    entryReport: Array<{ name: string; outcome: string; reason?: string; sourceId?: string }>;
  };
  sources: Array<{ sourceId: string; filename: string; status: string }>;
  events: IngestionEvent[];
}

export type TicketDetail = SourceTicketDetail | BatchTicketDetail;

export async function getUploadTicket(
  request: Request,
  kind: string,
  id: string,
): Promise<TicketDetail | null> {
  const response = await apiFetch(request, `/api/uploads/${kind}/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Response("Failed to load upload ticket", { status: response.status });
  }
  return (await response.json()) as TicketDetail;
}

export async function getSkeletonCheck(request: Request, id: string): Promise<RunDetail | null> {
  const response = await apiFetch(request, `/api/skeleton-checks/${id}`);
  // 404 → null so the route loader can throw its own 404 Response; every
  // other failure surfaces as a thrown Response caught by the ErrorBoundary.
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Response("Failed to load skeleton check", { status: response.status });
  }
  const data = (await response.json()) as { run: RunDetail };
  return data.run;
}

/** One search hit as the wire carries it (spec 010, contracts/api.md §1). */
export interface SearchResultItem {
  rank: number;
  chunkId: string;
  sourceId: string;
  generation: number;
  content: string;
  anchor: { headingTrail?: string[] } & Record<string, unknown>;
  scores: { fts: number | null; vector: number | null; fused: number; rerank: number | null };
  prerankPosition: number | null;
}

export interface SearchResponse {
  runId: string;
  query: string;
  config: { configName: string; fusion: string; k: number } & Record<string, unknown>;
  results: SearchResultItem[];
  timings: Record<string, number | null>;
}

/** Hybrid search over the corpus (spec 010 US1). The response is the
 * receipt's content — runId links to /records/retrievals/:id (US2). A non-OK
 * status surfaces the API's own error envelope message where possible: a 503
 * with the failing stage named is operator-actionable, not a generic fail. */
export async function searchLibrary(request: Request, query: string): Promise<SearchResponse> {
  const response = await apiFetch(request, "/api/retrieval/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    let message = "Search failed";
    try {
      const envelope = (await response.json()) as { error?: { message?: string } };
      if (envelope.error?.message) message = envelope.error.message;
    } catch {
      // fall through with the generic message
    }
    throw new Response(message, { status: response.status });
  }
  return (await response.json()) as SearchResponse;
}

/** Run-list item (spec 010 US2, contracts/api.md §2). */
export interface RetrievalRunListItem {
  id: string;
  query: string;
  origin: "interactive" | "eval";
  resultCount: number;
  createdAt: string;
  configName: string;
}

export interface RetrievalRunListPage {
  items: RetrievalRunListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface RetrievalRunDetail {
  id: string;
  query: string;
  origin: string;
  config: { configName: string; fusion: string; k: number } & Record<string, unknown>;
  embedding: { provider: string; model: string; dimensions: number };
  timings: Record<string, number | null>;
  createdAt: string;
  results: Array<
    SearchResultItem & {
      /** DERIVED at view time: no current-generation chunk carries this
       *  text's hash anymore — the snapshot below is the only copy. */
      superseded: boolean;
    }
  >;
}

export async function listRetrievalRuns(
  request: Request,
  opts: { limit?: number; offset?: number } = {},
): Promise<RetrievalRunListPage> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(request, `/api/retrieval/runs${query}`);
  if (!response.ok) {
    throw new Response("Failed to load retrieval runs", { status: response.status });
  }
  return (await response.json()) as RetrievalRunListPage;
}

export async function getRetrievalRun(request: Request, id: string): Promise<RetrievalRunDetail> {
  const response = await apiFetch(request, `/api/retrieval/runs/${id}`);
  if (!response.ok) {
    throw new Response("Retrieval run not found", { status: response.status });
  }
  return (await response.json()) as RetrievalRunDetail;
}

/** Gold-set surfaces (spec 010 US3, contracts/api.md §3). */
export interface GoldItem {
  id: string;
  question: string;
  expected: Array<{ chunkId: string; sourceId: string; contentSha256: string }>;
  split: "tuning" | "heldout";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  needsReconfirmation: boolean;
}

export async function listGoldItems(request: Request): Promise<GoldItem[]> {
  const response = await apiFetch(request, "/api/evals/gold");
  if (!response.ok) throw new Response("Failed to load the gold set", { status: response.status });
  return ((await response.json()) as { items: GoldItem[] }).items;
}

async function goldError(response: Response): Promise<string> {
  try {
    const envelope = (await response.json()) as { error?: { message?: string } };
    return envelope.error?.message ?? "Gold-set request failed";
  } catch {
    return "Gold-set request failed";
  }
}

export async function createGoldItem(
  request: Request,
  input: { question: string; chunkIds: string[]; split?: "tuning" | "heldout"; notes?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await apiFetch(request, "/api/evals/gold", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: input.question,
      expected: input.chunkIds.map((chunkId) => ({ chunkId })),
      ...(input.split ? { split: input.split } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });
  if (!response.ok) return { ok: false, message: await goldError(response) };
  return { ok: true };
}

export async function relabelGoldItem(
  request: Request,
  id: string,
  input: { question: string; chunkIds: string[]; notes?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await apiFetch(request, `/api/evals/gold/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: input.question,
      expected: input.chunkIds.map((chunkId) => ({ chunkId })),
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });
  if (!response.ok) return { ok: false, message: await goldError(response) };
  return { ok: true };
}
