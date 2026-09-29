/**
 * Minimal SSE line parser over a fetch response body (research R3). Only
 * `data:` fields matter to this contract: blank lines end an event,
 * multi-line `data:` fields join with `\n`, `:`-prefixed lines are comments,
 * and the literal payload `[DONE]` ends the stream without being yielded.
 */

export interface SseStream {
  /** Each event's joined `data:` payload, in order, excluding `[DONE]`. */
  events: AsyncIterable<string>;
  /** Valid once `events` is fully consumed: whether `[DONE]` was seen. */
  sawDone(): boolean;
}

export function parseSse(body: ReadableStream<Uint8Array>): SseStream {
  let sawDone = false;

  async function* generate(): AsyncGenerator<string> {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let dataLines: string[] = [];

    function takeEvent(): string | null {
      if (dataLines.length === 0) return null;
      const data = dataLines.join("\n");
      dataLines = [];
      if (data === "[DONE]") {
        sawDone = true;
        return null;
      }
      return data;
    }

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        for (
          let newlineAt = buffer.indexOf("\n");
          newlineAt !== -1;
          newlineAt = buffer.indexOf("\n")
        ) {
          const rawLine = buffer.slice(0, newlineAt);
          buffer = buffer.slice(newlineAt + 1);
          const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

          if (line === "") {
            const event = takeEvent();
            if (sawDone) return;
            if (event !== null) yield event;
            continue;
          }
          if (line.startsWith(":")) continue; // comment
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).replace(/^ /, ""));
          }
        }
      }
      // Stream closed mid-line and/or without a trailing blank line — treat
      // whatever's left in the buffer as a final line, then flush.
      if (buffer.startsWith("data:")) {
        dataLines.push(buffer.slice(5).replace(/^ /, ""));
      }
      const event = takeEvent();
      if (event !== null) yield event;
    } finally {
      reader.releaseLock();
    }
  }

  return { events: generate(), sawDone: () => sawDone };
}
