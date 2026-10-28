import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { createInvitation, InviteSection } from "~/invite-section";
import { SettingsView } from "~/routes/settings";

afterEach(() => vi.unstubAllGlobals());

test("a player sees no Invite a player section", () => {
  const html = renderToStaticMarkup(
    <SettingsView theme="system" userRole="player" onTheme={() => {}} />,
  );
  expect(html).toContain("Theme");
  expect(html).not.toContain("Invite a player");
});

test("the operator sees the section with expiry default 7", () => {
  const html = renderToStaticMarkup(
    <SettingsView theme="system" userRole="operator" onTheme={() => {}} />,
  );
  expect(html).toContain("Invite a player");
  expect(html).toContain("Expires in (days)");
  expect(html).toMatch(/value="7"/);
  expect(html).toContain('min="1"');
  expect(html).toContain('max="30"');
  expect(html).toContain("Create invitation");
});

test("Create invitation posts expiresInDays and returns the token", async () => {
  const fetchFn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          token: "raw-token",
          expiresAt: "2026-11-04T10:00:00.000Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchFn);
  const result = await createInvitation(7);
  expect(result).toEqual({
    ok: true,
    invitation: { token: "raw-token", expiresAt: "2026-11-04T10:00:00.000Z" },
  });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/auth/invitations");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({ expiresInDays: 7 });
});

test("a failure maps to the inline message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 403 })),
  );
  expect(await createInvitation(7)).toEqual({
    ok: false,
    message: "Could not create an invitation.",
  });
});

test("an issued token shows read-only with Copy, expiry and the once-note", () => {
  const html = renderToStaticMarkup(
    <InviteSection
      initialInvitation={{
        token: "raw-token",
        expiresAt: "2026-11-04T10:00:00.000Z",
      }}
    />,
  );
  expect(html).toMatch(
    /<input[^>]*readOnly=""[^>]*value="raw-token"|<input[^>]*value="raw-token"[^>]*readOnly=""/i,
  );
  expect(html).toContain(">Copy<");
  expect(html).toContain("Expires ");
  expect(html).toContain(
    "This token shows once. Send it to the player by a private channel.",
  );
});

test("a failure shows inline", () => {
  const html = renderToStaticMarkup(
    <InviteSection initialError="Could not create an invitation." />,
  );
  expect(html).toContain("Could not create an invitation.");
  expect(html).toContain('role="alert"');
});
