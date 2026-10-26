import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink, useRevalidator, useRouteLoaderData } from "react-router";
import { signOut } from "~/auth";
import {
  AskIcon,
  InfoIcon,
  LibraryIcon,
  MenuIcon,
  SettingsIcon,
  StackIcon,
  TableIcon,
} from "~/components/icons";
import type { loader as rootLoader } from "~/root";
import { uiCookie } from "~/ui-prefs";

interface NavItem {
  to: string;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
}

const OPERATOR_LINKS: NavItem[] = [
  { to: "/ask", label: "Ask", Icon: AskIcon },
  { to: "/books", label: "Library", Icon: LibraryIcon },
  { to: "/play", label: "Table", Icon: TableIcon },
];
const PLAYER_LINKS: NavItem[] = [
  { to: "/play", label: "Table", Icon: TableIcon },
];

const LINK_CLASS =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary";

/**
 * The app shell (plan D13, FR-001-FR-003): a role-aware sidebar that
 * collapses to icons, a bottom tab bar under `narrow:`, and Settings, the
 * user, and Sign out pinned at the bottom for both roles.
 */
export function Shell({ children }: { children: ReactNode }) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);

  const user = root?.user;
  const collapsed = root?.ui.sidebar === "collapsed";
  const links = user?.role === "operator" ? OPERATOR_LINKS : PLAYER_LINKS;

  function toggleSidebar() {
    // biome-ignore lint/suspicious/noDocumentCookie: the client-written UI cookie (plan D5) — no secret, not HttpOnly.
    document.cookie = uiCookie(
      "stacks-sidebar",
      collapsed ? "expanded" : "collapsed",
    );
    revalidator.revalidate();
  }

  async function handleSignOut() {
    setPending(true);
    await signOut();
    revalidator.revalidate();
  }

  return (
    <div className="flex min-h-dvh">
      <nav
        aria-label="Main"
        data-sidebar={collapsed ? "collapsed" : undefined}
        className="group sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground narrow:hidden data-[sidebar=collapsed]:w-16 data-[sidebar=collapsed]:items-center"
      >
        <div
          className="flex items-center gap-2 px-1 py-1 font-bold"
          title="the-stacks"
        >
          <StackIcon />
          <span className="group-data-[sidebar=collapsed]:sr-only">
            the-stacks
          </span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className={LINK_CLASS}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MenuIcon />
          <span className="group-data-[sidebar=collapsed]:sr-only">Menu</span>
        </button>
        <ul className="flex flex-1 flex-col gap-1">
          {links.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink to={to} title={label} className={LINK_CLASS}>
                <Icon />
                <span className="group-data-[sidebar=collapsed]:sr-only">
                  {label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto w-full border-t border-sidebar-border pt-2 text-sm">
          {user?.role === "operator" && (
            <NavLink to="/settings" title="Settings" className={LINK_CLASS}>
              <SettingsIcon />
              <span className="group-data-[sidebar=collapsed]:sr-only">
                Settings
              </span>
            </NavLink>
          )}
          <NavLink to="/about" title="About" className={LINK_CLASS}>
            <InfoIcon />
            <span className="group-data-[sidebar=collapsed]:sr-only">
              About
            </span>
          </NavLink>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sidebar-foreground/80 group-data-[sidebar=collapsed]:flex-col">
            <span className="group-data-[sidebar=collapsed]:sr-only">
              {user?.displayName} · {user?.role}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={pending}
              className="text-xs underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="min-w-0 flex-1 narrow:pb-14">{children}</main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-sidebar-border bg-sidebar narrow:flex"
      >
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.72rem] text-sidebar-foreground aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary"
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
