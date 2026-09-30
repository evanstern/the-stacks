import assert from "node:assert/strict";
import { test } from "node:test";
import { createSseParser } from "../app/ask/sse.ts";

test("a full message in one chunk", () => {
  const parser = createSseParser();
  const out = parser.push('event: delta\ndata: {"text":"hi"}\n\n');
  assert.deepEqual(out, [{ event: "delta", data: '{"text":"hi"}' }]);
});

test("chunk split mid-line", () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push("event: delta\ndat"), []);
  assert.deepEqual(parser.push('a: {"text":"hi"}\n\n'), [
    { event: "delta", data: '{"text":"hi"}' },
  ]);
});

test("chunk split mid-message (right after a full line)", () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push("event: delta\n"), []);
  assert.deepEqual(parser.push('data: {"text":"hi"}\n\n'), [
    { event: "delta", data: '{"text":"hi"}' },
  ]);
});

test("CRLF line endings", () => {
  const parser = createSseParser();
  const out = parser.push('event: done\r\ndata: {"citations":0}\r\n\r\n');
  assert.deepEqual(out, [{ event: "done", data: '{"citations":0}' }]);
});

test("bare CR line endings", () => {
  const parser = createSseParser();
  const out = parser.push('event: done\rdata: {"citations":0}\r\r');
  assert.deepEqual(out, [{ event: "done", data: '{"citations":0}' }]);
});

test("multiple data: lines join with \\n", () => {
  const parser = createSseParser();
  const out = parser.push("event: delta\ndata: line1\ndata: line2\n\n");
  assert.deepEqual(out, [{ event: "delta", data: "line1\nline2" }]);
});

test("comment lines are ignored", () => {
  const parser = createSseParser();
  const out = parser.push(':keep-alive\nevent: delta\ndata: {"text":"hi"}\n\n');
  assert.deepEqual(out, [{ event: "delta", data: '{"text":"hi"}' }]);
});

test("two messages in one chunk", () => {
  const parser = createSseParser();
  const out = parser.push(
    'event: delta\ndata: {"text":"a"}\n\nevent: delta\ndata: {"text":"b"}\n\n',
  );
  assert.deepEqual(out, [
    { event: "delta", data: '{"text":"a"}' },
    { event: "delta", data: '{"text":"b"}' },
  ]);
});

test("end() flushes nothing partial", () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push('event: delta\ndata: {"text":"hi"}'), []);
  assert.deepEqual(parser.end(), []);
});
