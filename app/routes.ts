import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("review", "routes/review.tsx"),
  route("review/:reviewItemId", "routes/review-detail.tsx"),
  route("chat", "routes/chat.tsx"),
  route("imports/:importJobId", "routes/import-detail.tsx"),
  route("documents/:documentId", "routes/document-detail.tsx"),
  route("retrieval/:retrievalRunId", "routes/retrieval-trace.tsx"),
  route("chat/:conversationId/sources/:citationId", "routes/chat-source.tsx"),
] satisfies RouteConfig;
