import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import appCss from "./app.css?url";
import { stacksContext } from "./context";
import { SignIn } from "./sign-in";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: appCss }];

/**
 * The identity gate (D3/FR-007): runs on every request, so a reload always
 * re-asks. Renders sign-in whenever the answer is "nobody" — for any route,
 * not just "/".
 */
export async function loader({ context }: Route.LoaderArgs) {
  return { user: await context.get(stacksContext).identity() };
}

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

export default function Root({ loaderData }: Route.ComponentProps) {
  if (!loaderData.user) {
    return <SignIn />;
  }
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <main>
      <h1>Error</h1>
      <p>{message}</p>
    </main>
  );
}
