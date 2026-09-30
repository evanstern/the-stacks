/**
 * Incremental SSE parser (plan D10, research R9). Splits on blank lines,
 * accepts \n, \r\n, and \r line endings, joins multiple `data:` lines with
 * "\n", ignores comment lines (starting with ":"), and keeps a partial
 * message across chunks. No imports — ask-sse.md's grammar (one `event:` +
 * one `data:` line) is a subset of what this parses.
 */

export interface SseMessage {
  event: string;
  data: string;
}

export interface SseParser {
  /** Feed decoded text; returns every message completed by this chunk. */
  push(chunk: string): SseMessage[];
  /** Call once after the stream ends. A trailing partial message (no
   * closing blank line) is dropped, never flushed. */
  end(): SseMessage[];
}

export function createSseParser(): SseParser {
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];

  function resetMessage() {
    eventName = "";
    dataLines = [];
  }

  function processLine(line: string, out: SseMessage[]) {
    if (line === "") {
      if (dataLines.length > 0) {
        out.push({ event: eventName || "message", data: dataLines.join("\n") });
      }
      resetMessage();
      return;
    }
    if (line.startsWith(":")) return; // comment
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") dataLines.push(value);
    // other fields (id, retry) are ignored — the contract does not use them
  }

  function push(chunk: string): SseMessage[] {
    const out: SseMessage[] = [];
    buffer += chunk;
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (ch === "\n" || ch === "\r") {
        processLine(buffer.slice(start, i), out);
        if (ch === "\r" && buffer[i + 1] === "\n") i++;
        start = i + 1;
      }
    }
    buffer = buffer.slice(start);
    return out;
  }

  function end(): SseMessage[] {
    buffer = "";
    resetMessage();
    return [];
  }

  return { push, end };
}
