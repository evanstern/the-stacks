/**
 * Per-browser UI state, read from the `Cookie` request header and written by
 * the client with `document.cookie` (plan D5). Pure, no imports, no runtime
 * dependency — the root loader and the client both call this.
 */

export type Sidebar = "expanded" | "collapsed";
export type Theme = "system" | "light" | "dark";

export interface UiPrefs {
  sidebar: Sidebar;
  theme: Theme;
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      out[name] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

/** Unknown or missing values fall back to `expanded` and `system`. */
export function readUiPrefs(cookieHeader: string | null): UiPrefs {
  const cookies = parseCookieHeader(cookieHeader);
  const sidebar: Sidebar =
    cookies["stacks-sidebar"] === "collapsed" ? "collapsed" : "expanded";
  const rawTheme = cookies["stacks-theme"];
  const theme: Theme =
    rawTheme === "light" || rawTheme === "dark" ? rawTheme : "system";
  return { sidebar, theme };
}

/** The `document.cookie` assignment string — one year, `Path=/`, `SameSite=Lax`. */
export function uiCookie(
  name: "stacks-sidebar" | "stacks-theme",
  value: string,
): string {
  return `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
