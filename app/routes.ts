import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/chat.tsx"),
  route("login", "routes/login.tsx"),
  route("imports", "routes/imports.tsx"),
  route("review", "routes/review.tsx"),
  route("review/:reviewItemId", "routes/review-detail.tsx"),
  route("chat", "routes/chat-alias.tsx"),
  route("chat/:conversationId", "routes/chat-conversation.tsx", [
    route("sources/:citationId", "routes/chat-source.tsx"),
  ]),
  route("imports/:importJobId", "routes/import-detail.tsx"),
  route("sources/:sourceId", "routes/source-detail.tsx"),
  route("documents/:documentId", "routes/document-detail.tsx"),
  route("retrieval/:retrievalRunId", "routes/retrieval-trace.tsx"),
] satisfies RouteConfig;
