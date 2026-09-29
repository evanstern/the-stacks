import { describe, expect, it } from "vitest";
import { ValidationError } from "../../src/errors.js";
import type { ParsedBook } from "../../src/library/ddb/index.js";
import type { DbClient } from "../../src/library/store.js";
import { storeParsedBook } from "../../src/library/store.js";

/**
 * US1 unit tests (specs/013-library-schema/tasks.md T004, contracts/
 * library-store.md invariant 1): span validation happens before any
 * database call. `untouchableDb` throws on any property access, so a bug
 * that skips validation and reaches the database fails the test loudly
 * rather than by a slow, flaky connection error.
 */

const untouchableDb = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "storeParsedBook touched the database before validation rejected the input",
      );
    },
  },
) as unknown as DbClient;

function book(overrides: Partial<ParsedBook> = {}): ParsedBook {
  return {
    book: "Fixture Book",
    text: "Hello world",
    blocks: [
      {
        kind: "prose",
        path: ["Fixture Book"],
        text: "Hello",
        anchor: {
          book: "Fixture Book",
          path: ["Fixture Book"],
          start: 0,
          end: 5,
        },
      },
    ],
    ...overrides,
  };
}

describe("storeParsedBook — span validation (US1, no DB)", () => {
  it("T004: rejects a reversed span", async () => {
    const input = book({
      blocks: [
        {
          kind: "prose",
          path: ["Fixture Book"],
          text: "Hello",
          anchor: {
            book: "Fixture Book",
            path: ["Fixture Book"],
            start: 5,
            end: 0,
          },
        },
      ],
    });

    await expect(storeParsedBook(untouchableDb, input)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("T004: rejects an empty span", async () => {
    const input = book({
      blocks: [
        {
          kind: "prose",
          path: ["Fixture Book"],
          text: "Hello",
          anchor: {
            book: "Fixture Book",
            path: ["Fixture Book"],
            start: 3,
            end: 3,
          },
        },
      ],
    });

    await expect(storeParsedBook(untouchableDb, input)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("T004: rejects a span past text.length", async () => {
    const input = book({
      text: "Hello",
      blocks: [
        {
          kind: "prose",
          path: ["Fixture Book"],
          text: "Hello",
          anchor: {
            book: "Fixture Book",
            path: ["Fixture Book"],
            start: 0,
            end: 100,
          },
        },
      ],
    });

    await expect(storeParsedBook(untouchableDb, input)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("T004: rejects a block whose text.slice(start, end) differs from its text", async () => {
    const input = book({
      text: "Hello world",
      blocks: [
        {
          kind: "prose",
          path: ["Fixture Book"],
          text: "wrong",
          anchor: {
            book: "Fixture Book",
            path: ["Fixture Book"],
            start: 0,
            end: 5,
          },
        },
      ],
    });

    await expect(storeParsedBook(untouchableDb, input)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
