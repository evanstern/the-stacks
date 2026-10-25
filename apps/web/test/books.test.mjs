import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookKey,
  deriveBooks,
  hasActive,
  pill,
  stageIndex,
} from "../app/library/books.ts";

function job(overrides = {}) {
  return {
    id: "j1",
    book: "Basic Rules",
    status: "queued",
    stage: null,
    format: "markdown",
    filename: "basic-rules.md",
    bytes: 100,
    attempts: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    result: null,
    error: null,
    ...overrides,
  };
}

test("bookKey trims and lower-cases", () => {
  assert.equal(bookKey("  Basic Rules  "), "basic rules");
});

test("pill: every status", () => {
  assert.equal(pill(job({ status: "queued" })), "Ingesting · queued");
  assert.equal(
    pill(job({ status: "running", stage: "parse" })),
    "Ingesting · parse",
  );
  assert.equal(pill(job({ status: "running", stage: null })), "Ingesting");
  assert.equal(pill(job({ status: "failed" })), "Failed");
  assert.equal(
    pill(
      job({
        status: "succeeded",
        result: {
          documentId: "d1",
          chunkCount: 1,
          pages: 1,
          embedding: { status: "embedded", model: "m", count: 1 },
        },
      }),
    ),
    "Ready",
  );
  assert.equal(
    pill(
      job({
        status: "succeeded",
        result: {
          documentId: "d1",
          chunkCount: 1,
          pages: 1,
          embedding: { status: "skipped", reason: "no provider" },
        },
      }),
    ),
    "Search-only",
  );
});

test("stageIndex: null stage", () => {
  assert.equal(stageIndex(job({ status: "queued", stage: null })), -1);
  assert.equal(stageIndex(job({ status: "failed", stage: null })), -1);
  assert.equal(stageIndex(job({ status: "running", stage: "store" })), 2);
  assert.equal(stageIndex(job({ status: "succeeded", stage: null })), 4);
});

test("deriveBooks: groups by trimmed lower-case name, newest wins", () => {
  const jobs = [
    job({
      id: "old",
      book: "Basic Rules",
      status: "failed",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    job({
      id: "new",
      book: " basic rules ",
      status: "succeeded",
      createdAt: "2026-01-02T00:00:00.000Z",
      result: {
        documentId: "d1",
        chunkCount: 1,
        pages: 1,
        embedding: { status: "embedded", model: "m", count: 1 },
      },
    }),
  ];
  const books = deriveBooks(jobs);
  assert.equal(books.length, 1);
  assert.equal(books[0].name, "basic rules");
  assert.equal(books[0].pill, "Ready");
});

test("hasActive", () => {
  assert.equal(hasActive([job({ status: "queued" })]), true);
  assert.equal(hasActive([job({ status: "running" })]), true);
  assert.equal(hasActive([job({ status: "succeeded" })]), false);
  assert.equal(hasActive([]), false);
});
