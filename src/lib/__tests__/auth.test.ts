// @vitest-environment node
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, writable: true });

import { vi, test, expect, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

// auth.ts uses "server-only" to block client-side imports — stub it out
vi.mock("server-only", () => ({}));

// In-memory cookie store that mimics next/headers cookies()
const cookieStore = {
  _store: new Map<string, string>(),
  get(name: string) {
    const value = this._store.get(name);
    return value ? { name, value } : undefined;
  },
  set(name: string, value: string, _options?: unknown) {
    this._store.set(name, value);
  },
  delete(name: string) {
    this._store.delete(name);
  },
};

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

const SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

// Helper: mint a valid JWT that matches the auth module's own format
async function mintToken(
  payload: object,
  expirationTime: string = "7d"
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expirationTime)
    .setIssuedAt()
    .sign(SECRET);
}

beforeEach(() => {
  cookieStore._store.clear();
});

// ─── createSession ───────────────────────────────────────────────────────────

test("createSession sets the auth-token cookie", async () => {
  await createSession("user-1", "alice@example.com");
  expect(cookieStore._store.has(COOKIE_NAME)).toBe(true);
});

test("createSession stores userId and email in the token payload", async () => {
  await createSession("user-1", "alice@example.com");
  // Read the token back through getSession to verify the payload round-trips
  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("alice@example.com");
});

// ─── getSession ──────────────────────────────────────────────────────────────

test("getSession returns null when no cookie is present", async () => {
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const token = await mintToken({ userId: "user-2", email: "bob@example.com" });
  cookieStore._store.set(COOKIE_NAME, token);

  const session = await getSession();
  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("bob@example.com");
});

test("getSession returns null for a tampered token", async () => {
  cookieStore._store.set(COOKIE_NAME, "not.a.valid.jwt");
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await mintToken(
    { userId: "user-3", email: "expired@example.com" },
    "0s" // expires immediately
  );
  cookieStore._store.set(COOKIE_NAME, token);

  const session = await getSession();
  expect(session).toBeNull();
});

// ─── deleteSession ───────────────────────────────────────────────────────────

test("deleteSession removes the auth-token cookie", async () => {
  await createSession("user-1", "alice@example.com");
  expect(cookieStore._store.has(COOKIE_NAME)).toBe(true);

  await deleteSession();
  expect(cookieStore._store.has(COOKIE_NAME)).toBe(false);
});

// ─── verifySession ───────────────────────────────────────────────────────────

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["cookie"] = `${COOKIE_NAME}=${token}`;
  return new NextRequest("http://localhost/", { headers });
}

test("verifySession returns null when the request has no cookie", async () => {
  const result = await verifySession(makeRequest());
  expect(result).toBeNull();
});

test("verifySession returns the session payload for a valid token", async () => {
  const token = await mintToken({ userId: "user-4", email: "carol@example.com" });
  const result = await verifySession(makeRequest(token));
  expect(result?.userId).toBe("user-4");
  expect(result?.email).toBe("carol@example.com");
});

test("verifySession returns null for an invalid token", async () => {
  const result = await verifySession(makeRequest("garbage-token"));
  expect(result).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const token = await mintToken(
    { userId: "user-5", email: "stale@example.com" },
    "0s"
  );
  const result = await verifySession(makeRequest(token));
  expect(result).toBeNull();
});
