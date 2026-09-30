import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRevalidator,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import appCss from "./app.css?url";
import { stacksContext } from "./context";
import { Shell } from "./shell/shell";
import { SignIn } from "./sign-in";
import { AppStoreProvider } from "./store/provider";
import { readUiPrefs } from "./ui-prefs";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
];

/**
 * The identity gate (D3/FR-007): runs on every request, so a reload always
 * re-asks. Renders sign-in whenever the answer is "nobody" — for any route,
 * not just "/". Also reads the per-browser UI cookies (plan D5) so the
 * first byte of HTML already carries the right theme and sidebar state.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = await context.get(stacksContext).identity();
  const ui = readUiPrefs(request.headers.get("cookie"));
  return { user, ui };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = data?.ui.theme;
  return (
    <html
      lang="en"
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
    >
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
  const { user } = loaderData;
  const revalidator = useRevalidator();
  if (!user) {
    return <SignIn />;
  }
  return (
    <AppStoreProvider
      key={user.id}
      onUnauthorized={() => revalidator.revalidate()}
    >
      <Shell>
        <Outlet />
      </Shell>
    </AppStoreProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  return (
    <main>
      <h1>Error</h1>
      <p>{message}</p>
    </main>
  );
}
