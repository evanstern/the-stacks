import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Placeholder entry for Phase 1 (SPA shell + serving). The real app —
// TanStack Router route tree and QueryClientProvider — is wired in Phase 3
// (US2, T011), which also replaces this file's contents.
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <p>the-stacks</p>
  </StrictMode>,
);
