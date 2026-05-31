import { describe, expect, it, vi } from "vitest";

const authEnv = {
  IKIS_SHARED_PASSWORD: "owner-password",
  IKIS_AUTH_SECRET: "test-auth-secret",
};

async function loadAuth() {
  vi.resetModules();
  process.env.IKIS_SHARED_PASSWORD = authEnv.IKIS_SHARED_PASSWORD;
  process.env.IKIS_AUTH_SECRET = authEnv.IKIS_AUTH_SECRET;
  return import("../../app/lib/auth.server");
}

describe("self-hosted auth", () => {
  it("sets an HMAC-signed HttpOnly Strict cookie for a valid password", async () => {
    const auth = await loadAuth();

    expect(auth.verifySharedPassword("owner-password")).toBe(true);
    expect(auth.verifySharedPassword("wrong-password")).toBe(false);

    process.env.NODE_ENV = "production";
    process.env.PUBLIC_URL = "https://ikis.example.test";

    const cookie = auth.buildAuthCookieHeader(auth.signAuthCookie());

    expect(cookie).toMatch(/ikis_auth=\d+\.[0-9a-f]+;/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("Secure");
    expect(auth.verifyAuthCookie(cookie.match(/ikis_auth=([^;]+)/)?.[1])).toBe(true);
  });

  it("allows explicit local HTTP production URLs to omit Secure", async () => {
    const auth = await loadAuth();

    process.env.NODE_ENV = "production";
    process.env.PUBLIC_URL = "http://localhost:8423";

    expect(auth.buildAuthCookieHeader(auth.signAuthCookie())).not.toContain("Secure");
  });

  it("redirects unauthenticated page requests and returns 401 for actions", async () => {
    const auth = await loadAuth();

    expect(() => auth.requireAuthenticated(new Request("http://localhost/review?filter=open"))).toThrowError(Response);

    try {
      auth.requireAuthenticated(new Request("http://localhost/review?filter=open"));
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login?next=%2Freview%3Ffilter%3Dopen");
    }

    try {
      auth.requireAuthenticated(new Request("http://localhost/review"), { api: true });
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(401);
      expect(await (error as Response).text()).toBe("unauthorized");
    }
  });

  it("protects corpus inspection routes before persisted data is read", async () => {
    const auth = await loadAuth();
    const protectedRoutes = [
      "http://localhost/imports/job-1",
      "http://localhost/review/item-1",
      "http://localhost/documents/doc-1",
      "http://localhost/retrieval/run-1",
    ];

    for (const route of protectedRoutes) {
      try {
        auth.requireAuthenticated(new Request(route));
        throw new Error(`Expected ${route} to require authentication`);
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        const url = new URL(route);
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe(`/login?next=${encodeURIComponent(url.pathname)}`);
      }
    }
  });

  it("fails with actionable errors when auth secrets are missing", async () => {
    vi.resetModules();
    delete process.env.IKIS_SHARED_PASSWORD;
    delete process.env.IKIS_AUTH_SECRET;

    const auth = await import("../../app/lib/auth.server");

    expect(() => auth.assertAuthConfigured()).toThrow(/IKIS_SHARED_PASSWORD is required/);

    process.env.IKIS_SHARED_PASSWORD = authEnv.IKIS_SHARED_PASSWORD;
    expect(() => auth.assertAuthConfigured()).toThrow(/IKIS_AUTH_SECRET is required/);
  });
});
