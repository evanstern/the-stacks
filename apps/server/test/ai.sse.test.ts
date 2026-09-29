import { describe, expect, it } from "vitest";
import { parseSse } from "../src/ai/sse.js";

/** A body stream that enqueues each string as its own chunk — callers control chunk boundaries. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const { events, sawDone } = parseSse(stream);
  const data: string[] = [];
  for await (const event of events) data.push(event);
  return { data, sawDone: sawDone() };
}

describe("parseSse", () => {
  it("yields each blank-line-framed data payload, in order", async () => {
    const { data, sawDone } = await collect(
      streamOf(["data: one\n\n", "data: two\n\ndata: [DONE]\n\n"]),
    );
    expect(data).toEqual(["one", "two"]);
    expect(sawDone).toBe(true);
  });

  it("joins a multi-line data field with newlines", async () => {
    const { data } = await collect(
      streamOf(["data: line one\ndata: line two\n\n"]),
    );
    expect(data).toEqual(["line one\nline two"]);
  });

  it("ignores comment lines", async () => {
    const { data } = await collect(streamOf([": keep-alive\ndata: hello\n\n"]));
    expect(data).toEqual(["hello"]);
  });

  it("reassembles a line split across chunk boundaries", async () => {
    const { data } = await collect(streamOf(["da", "ta: hel", "lo\n", "\n"]));
    expect(data).toEqual(["hello"]);
  });

  it("stops at [DONE] without yielding it, and marks the stream done", async () => {
    const { data, sawDone } = await collect(
      streamOf(["data: a\n\n", "data: [DONE]\n\n", "data: never seen\n\n"]),
    );
    expect(data).toEqual(["a"]);
    expect(sawDone).toBe(true);
  });

  it("reports a stream that ends without [DONE]", async () => {
    const { data, sawDone } = await collect(streamOf(["data: only\n\n"]));
    expect(data).toEqual(["only"]);
    expect(sawDone).toBe(false);
  });

  it("flushes a trailing event even if the stream closes without a final blank line", async () => {
    const { data, sawDone } = await collect(streamOf(["data: trailing"]));
    expect(data).toEqual(["trailing"]);
    expect(sawDone).toBe(false);
  });
});
