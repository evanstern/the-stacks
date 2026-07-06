/**
 * Root route for the web app (React Router 7 framework mode, SSR).
 *
 * Every route in routes.ts renders inside this document shell. There is no
 * app-level data or auth logic here on purpose: auth gating lives solely in
 * routes/protected-layout.tsx, and all API access happens in loaders/actions
 * via app/lib/api.server.ts (the browser never calls the API — research R9).
 * This file only owns the <html> skeleton, global CSS, and the last-resort
 * error page.
 */
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import type { Route } from "./+types/root";

import "./app.css";

// RR7 renders Layout for both successful pages and the ErrorBoundary below,
// so the document shell (meta, styles, scripts) survives even a hard crash.
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>the Stacks v3</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// Catch-all for errors no child route handled. Thrown Responses (e.g. the
// 404 from skeleton-check-detail's loader) get a status-aware message; raw
// Error details are exposed only in dev so prod never leaks internals.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="mt-2 text-muted-foreground">{details}</p>
    </main>
  );
}
