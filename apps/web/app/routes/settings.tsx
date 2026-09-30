import { useRevalidator, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import type { Theme } from "~/ui-prefs";
import { uiCookie } from "~/ui-prefs";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * FR-039: theme choice only — System / Light / Dark. Sets `data-theme` on
 * `<html>` at once, then persists the cookie and revalidates so the root
 * loader's data agrees (plan D5, D14).
 */
export default function Settings() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const revalidator = useRevalidator();
  const current = root?.ui.theme ?? "system";

  function setTheme(theme: Theme) {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = theme;
    }
    // biome-ignore lint/suspicious/noDocumentCookie: the client-written UI cookie (plan D5) — no secret, not HttpOnly.
    document.cookie = uiCookie("stacks-theme", theme);
    revalidator.revalidate();
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold">Settings</h1>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted-foreground">Theme</legend>
        {OPTIONS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="theme"
              value={value}
              checked={current === value}
              onChange={() => setTheme(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
