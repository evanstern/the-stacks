const configuredApiUrl = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;

function resolveApiUrl() {
  if (configuredApiUrl) {
    const configuredUrl = new URL(configuredApiUrl);
    if (typeof window !== "undefined" && isLocalHost(configuredUrl.hostname)) {
      configuredUrl.hostname = window.location.hostname;
    }
    return configuredUrl.toString().replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return "http://localhost:8000";
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

const API_URL = resolveApiUrl();

export type AuthStatus = {
  authenticated: boolean;
};

export type ChatSession = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type UploadQueued = {
  upload_id: string;
  job_id: string;
  queued: boolean;
};

export type UploadRecord = {
  id: string;
  original_filename: string;
  content_type: string;
  extension: string;
  sha256: string;
  size_bytes: number;
  created_at: string;
};

export type IngestionJob = {
  id: string;
  upload_id: string;
  status: string;
  error_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type IngestionEvent = {
  id: string;
  ingestion_job_id: string;
  upload_id: string;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SourceRecord = {
  id: string;
  upload_id: string;
  title: string | null;
  original_filename: string;
  extension: string;
  sha256: string;
  chunk_count: number;
  indexed_chunk_count: number;
  created_at: string;
};

export type ChunkRecord = {
  id: string;
  upload_id: string;
  ingestion_job_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RetrievalRun = {
  id: string;
  chat_session_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  query: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RecordsStats = {
  uploads: number;
  jobs: number;
  sources: number;
  chunks: number;
  indexed_chunks: number;
  retrieval_runs: number;
};

export type Citation = {
  id: string;
  document_chunk_id: string;
  label: string;
  metadata: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  chat_session_id: string;
  role: "user" | "assistant" | string;
  content: string;
  metadata: Record<string, unknown>;
  citations: Citation[];
  created_at: string;
};

export type ChatMessageEnvelope = {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  retrieval_run_id: string;
  no_evidence: boolean;
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

class ApiNetworkError extends Error {
  constructor(message = "The archive API is unreachable. Check the server configuration and try again.") {
    super(message);
    this.name = "ApiNetworkError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers,
    ...init,
  }).catch((error: unknown) => {
    throw new ApiNetworkError(error instanceof Error ? error.message : undefined);
  });

  if (!response.ok) {
    const message = await errorMessage(response);
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isApiNetworkError(error: unknown): error is ApiNetworkError {
  return error instanceof ApiNetworkError;
}

async function errorMessage(response: Response) {
  const fallback = response.statusText || "Request failed";
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fallback;
  }
  const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  if (typeof payload?.detail === "string") {
    return payload.detail;
  }
  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item) => validationDetailMessage(item))
      .filter((message): message is string => Boolean(message))
      .join(" ") || fallback;
  }
  return fallback;
}

function validationDetailMessage(item: unknown) {
  if (typeof item === "string") {
    return item;
  }
  if (typeof item === "object" && item !== null && "msg" in item) {
    const message = (item as { msg?: unknown }).msg;
    return typeof message === "string" ? message : null;
  }
  return null;
}

export async function getAuthStatus() {
  return request<AuthStatus>("/auth/me");
}

export async function login(password: string) {
  return request<AuthStatus>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout() {
  return request<AuthStatus>("/auth/logout", { method: "POST" });
}

export async function getLatestSession() {
  return request<ChatSession | null>("/sessions/latest");
}

export async function listSessions() {
  return request<ChatSession[]>("/sessions");
}

export async function createSession() {
  return request<ChatSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title: "Table session" }),
  });
}

export async function getSession(sessionId: string) {
  return request<ChatSession>(`/sessions/${sessionId}`);
}

export async function getSessionMessages(sessionId: string) {
  return request<ChatMessage[]>(`/sessions/${sessionId}/messages`);
}

export async function sendSessionMessage(sessionId: string, content: string) {
  return request<ChatMessageEnvelope>(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getOrCreateSession() {
  const latest = await getLatestSession();
  return latest ?? createSession();
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<UploadQueued>("/uploads", {
    method: "POST",
    body: formData,
  });
}

export async function getIngestionJob(jobId: string) {
  return request<IngestionJob>(`/jobs/${jobId}`);
}

export async function getJobEvents(jobId: string) {
  return request<IngestionEvent[]>(`/jobs/${jobId}/events`);
}

export async function listUploads() {
  return request<UploadRecord[]>("/records/uploads");
}

export async function getRecordsStats() {
  return request<RecordsStats>("/records/stats");
}

export async function listJobs() {
  return request<IngestionJob[]>("/records/jobs");
}

export async function listRetrievalRuns() {
  return request<RetrievalRun[]>("/records/retrieval-runs");
}

export async function listSources() {
  return request<SourceRecord[]>("/records/sources");
}

export async function listChunks() {
  return request<ChunkRecord[]>("/records/chunks");
}
