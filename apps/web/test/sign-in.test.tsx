import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { SignInCard, submitRedeem } from "~/sign-in";

afterEach(() => vi.unstubAllGlobals());

const input = {
  token: "  tok-123  ",
  username: "rin",
  displayName: "Rin",
  password: "pw",
};

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

test("the card offers Have an invitation?", () => {
  const html = renderToStaticMarkup(<SignInCard onSignedIn={() => {}} />);
  expect(html).toContain("Have an invitation?");
  expect(html).toContain("Sign in");
  expect(html).not.toContain("Invitation token");
});

test("redeem mode shows the four fields and Back to sign in", () => {
  const html = renderToStaticMarkup(
    <SignInCard onSignedIn={() => {}} initialMode="redeem" />,
  );
  expect(html).toContain("Redeem an invitation");
  for (const label of [
    "Invitation token",
    "Username",
    "Display name",
    "Password",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toMatch(/autocomplete="new-password"/i);
  expect(html).toContain("Create account");
  expect(html).toContain("Back to sign in");
  expect(html).not.toContain("Have an invitation?");
});

test("Back to sign in restores the sign-in form", () => {
  const html = renderToStaticMarkup(
    <SignInCard onSignedIn={() => {}} initialMode="signin" />,
  );
  expect(html).toContain("Have an invitation?");
  expect(html).not.toContain("Create account");
});

test("submit posts the trimmed token and revalidates on 201", async () => {
  const fetchFn = stubFetch(201, {
    user: { id: "u", displayName: "Rin", role: "player" },
  });
  const onSignedIn = vi.fn();
  const result = await submitRedeem(input, onSignedIn);
  expect(result).toEqual({ ok: true });
  expect(onSignedIn).toHaveBeenCalledTimes(1);
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/auth/invitations/redeem");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({
    token: "tok-123",
    username: "rin",
    displayName: "Rin",
    password: "pw",
  });
  expect(url).not.toContain("tok-123");
  expect(globalThis.location?.href ?? "").not.toContain("tok-123");
});

test("a 400 token issue shows the invalid-token message", async () => {
  stubFetch(400, {
    error: {
      kind: "validation",
      message: "x",
      issues: [{ path: "token", message: "server text" }],
    },
  });
  const onSignedIn = vi.fn();
  const result = await submitRedeem(input, onSignedIn);
  expect(result).toEqual({
    ok: false,
    messages: ["This invitation is invalid, expired, or already redeemed."],
  });
  expect(onSignedIn).not.toHaveBeenCalled();
});

test("a 409 shows the username message", async () => {
  stubFetch(409, { error: { kind: "conflict", message: "taken" } });
  expect(await submitRedeem(input, () => {})).toEqual({
    ok: false,
    messages: ["That username is already taken."],
  });
});

test("other 400 issues show each message", async () => {
  stubFetch(400, {
    error: {
      kind: "validation",
      message: "x",
      issues: [
        { path: "username", message: "Too short." },
        { path: "password", message: "Too weak." },
      ],
    },
  });
  expect(await submitRedeem(input, () => {})).toEqual({
    ok: false,
    messages: ["Too short.", "Too weak."],
  });
});

test("anything else shows the generic message", async () => {
  stubFetch(500, {});
  expect(await submitRedeem(input, () => {})).toEqual({
    ok: false,
    messages: ["Something went wrong. Try again."],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  expect(await submitRedeem(input, () => {})).toEqual({
    ok: false,
    messages: ["Something went wrong. Try again."],
  });
});
