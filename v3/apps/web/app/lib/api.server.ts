function apiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? "http://api:4401";
}

/**
 * The browser never calls the API directly (FR-019, research R9) — this is
 * the one place `web` reaches across the seam, relaying the incoming
 * request's session cookie onward and letting callers relay Set-Cookie back.
 */
export async function apiFetch(request: Request, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
}

export async function login(request: Request, password: string): Promise<Response> {
  return apiFetch(request, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout(request: Request): Promise<Response> {
  return apiFetch(request, "/api/auth/logout", { method: "POST" });
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  const response = await apiFetch(request, "/api/auth/session");
  return response.status === 200;
}

export interface RunSummary {
  id: string;
  status: "accepted" | "running" | "succeeded" | "failed";
  createdAt: string;
  completedAt: string | null;
}

export interface RunEvent {
  seam: string;
  ok: boolean;
  durationMs: number | null;
  detail: Record<string, unknown>;
  at: string;
}

export interface RunDetail extends RunSummary {
  startedAt: string | null;
  outcome?: { class: string; seam: string; message: string };
  vector?: {
    id: string;
    provider: string;
    model: string;
    dimensions: number;
    readbackDistance: number | null;
  };
  events: RunEvent[];
}

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
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { runs: RunSummary[] };
  return data.runs;
}

export async function getSkeletonCheck(request: Request, id: string): Promise<RunDetail | null> {
  const response = await apiFetch(request, `/api/skeleton-checks/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Response("Failed to load skeleton check", { status: response.status });
  }
  const data = (await response.json()) as { run: RunDetail };
  return data.run;
}
