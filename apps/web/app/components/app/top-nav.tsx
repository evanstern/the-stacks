import { Form, NavLink, useLocation } from "react-router";
import { Archive, LogOut, MessageCircle, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themeStorageKey = "the-stacks-theme";

const themes = [
  { value: "ember", label: "Ember" },
  { value: "midnight", label: "Midnight" },
  { value: "moss", label: "Moss" },
  { value: "plum", label: "Plum" },
  { value: "carbon", label: "Carbon" },
] as const;

type ThemeName = (typeof themes)[number]["value"];

const defaultTheme: ThemeName = "ember";

function isThemeName(value: string | null): value is ThemeName {
  return themes.some((theme) => theme.value === value);
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

export function TopNav() {
  const { pathname } = useLocation();
  const [theme, setTheme] = useState<ThemeName>(defaultTheme);
  const chatPath = pathname.startsWith("/chat/") ? pathname : "/";
  const navItems = [
    { to: chatPath, label: "Chat", icon: MessageCircle },
    { to: "/upload", label: "Upload", icon: Upload },
    { to: "/records", label: "Records", icon: Archive },
  ];

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    const initialTheme = isThemeName(storedTheme) ? storedTheme : defaultTheme;

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function handleThemeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextTheme = event.target.value;

    if (!isThemeName(nextTheme)) {
      return;
    }

    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
  }

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <NavLink to="/" className="brand-link" aria-label="The Stacks chat home">
          <span className="icon-mark">
            TS
          </span>
          <span className="brand-copy">
            <span className="brand-title">The Stacks</span>
            <span className="micro-label text-muted">Private table archive</span>
          </span>
        </NavLink>
        <div className="top-nav-actions">
          <nav className="nav-pill" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "nav-link",
                    isActive && "nav-link-active",
                  )
                }
              >
                <item.icon className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <label className="theme-select-wrap" htmlFor="theme-select">
            <span className="sr-only">Theme</span>
            <select
              id="theme-select"
              className="theme-select"
              value={theme}
              onChange={handleThemeChange}
              aria-label="Theme palette"
            >
              {themes.map((themeOption) => (
                <option key={themeOption.value} value={themeOption.value}>
                  {themeOption.label}
                </option>
              ))}
            </select>
          </label>
          <Form method="post" action="/logout">
            <Button type="submit" variant="ghost" className="nav-logout">
              <LogOut className="mr-0 size-3.5 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </Form>
        </div>
      </div>
    </header>
  );
}
