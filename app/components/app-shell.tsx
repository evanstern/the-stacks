import { MessageSquareText, Scale, UploadCloud } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

import { cn } from "~/lib/utils";

const navItems = [
  { label: "Chat", href: "/", icon: MessageSquareText },
  { label: "Imports", href: "/imports", icon: UploadCloud },
  { label: "Review", href: "/review", icon: Scale },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen text-[var(--color-foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 md:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="sticky top-4 z-20 mb-4 rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-panel)] backdrop-blur lg:mb-0 lg:flex lg:h-[calc(100vh-2rem)] lg:w-64 lg:flex-col lg:p-4">
          <a href="/" className="hidden rounded-3xl px-3 py-4 lg:block">
            <span className="block font-[var(--font-display)] text-3xl font-bold tracking-[-0.03em] text-[var(--color-card-foreground)]">ikis.ai</span>
            <span className="mt-1 block text-sm leading-6 text-[var(--color-muted-foreground)]">Grounded corpus workspace</span>
          </a>
          <nav className="grid grid-cols-3 gap-2 lg:mt-6 lg:grid-cols-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/"}
                  className={({ isActive }) => cn(
                    "flex items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-secondary-foreground)] lg:justify-start lg:rounded-2xl lg:px-4",
                    isActive && "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-auto hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)] lg:block">
            Chat stays primary; imports and review are supporting workspaces for keeping answers cited.
          </div>
        </aside>
        <div className="flex-1 pb-8 lg:py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
