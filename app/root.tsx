import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type * as React from "react";
import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Alegreya:wght@500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap",
  },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let detail = "The workspace shell could not render this route.";

  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
    detail = error.data || detail;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-6 py-16 text-[var(--color-foreground)]">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)]">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
          Route error
        </p>
        <h1 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[var(--color-card-foreground)]">
          {message}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-muted-foreground)]">{detail}</p>
      </section>
    </main>
  );
}
