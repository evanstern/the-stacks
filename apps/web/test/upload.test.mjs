import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyUploadResponse } from "../app/library/upload.ts";

test("202 → accepted, carries the job", () => {
  const job = { id: "j1", book: "Basic Rules" };
  const outcome = classifyUploadResponse({ status: 202, body: { job } });
  assert.deepEqual(outcome, { kind: "accepted", job });
});

for (const status of [400, 409, 413]) {
  test(`${status} → error with the body's message`, () => {
    const outcome = classifyUploadResponse({
      status,
      body: { error: { message: "nope" } },
    });
    assert.deepEqual(outcome, { kind: "error", message: "nope" });
  });
}

test("401 → unauthorized", () => {
  assert.deepEqual(classifyUploadResponse({ status: 401, body: null }), {
    kind: "unauthorized",
  });
});

test("403 → forbidden", () => {
  assert.deepEqual(classifyUploadResponse({ status: 403, body: null }), {
    kind: "forbidden",
  });
});

test('"network" → the connection-check message', () => {
  assert.deepEqual(classifyUploadResponse("network"), {
    kind: "error",
    message: "Upload failed. Check your connection and try again.",
  });
});

test('"aborted" → cancelled', () => {
  assert.deepEqual(classifyUploadResponse("aborted"), { kind: "cancelled" });
});
