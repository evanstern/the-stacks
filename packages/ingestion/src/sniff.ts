/**
 * Media-type sniffing (008 research R7, US3): the pipeline trusts MAGIC BYTES
 * and extensions — never the client's declared content type. Used at two
 * doors: API intake (whole uploads) and the worker's ZIP expansion (per
 * entry). A declared-vs-actual mismatch (the renamed-binary edge case) is an
 * honest unsupported_type refusal, not a best-effort guess.
 *
 * The supported set is deliberately the FR-028 lineup's inputs plus ZIP:
 * text/html, text/markdown, text/plain, application/zip. PDF is the famous
 * deliberate 415 (scope: out for v3).
 */

export interface SniffResult {
  mediaType: "text/html" | "text/markdown" | "text/plain" | "application/zip";
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

/** Magic prefixes we RECOGNIZE as definitely-not-ingestible — used to catch
 * renamed binaries (a .html that is really a PNG) with a specific answer. */
const BINARY_MAGICS: ReadonlyArray<{ name: string; magic: number[] }> = [
  { name: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { name: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { name: "jpeg", magic: [0xff, 0xd8, 0xff] },
  { name: "gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { name: "zip", magic: ZIP_MAGIC },
];

function hasMagic(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

function looksBinary(bytes: Uint8Array): string | null {
  for (const { name, magic } of BINARY_MAGICS) {
    if (hasMagic(bytes, magic)) return name;
  }
  // NUL bytes in the head are a strong non-text signal.
  const head = bytes.slice(0, 512);
  return head.includes(0) ? "binary" : null;
}

function extensionOf(filename: string): string {
  const match = /\.([^.\/\\]+)$/.exec(filename);
  return match ? match[1]!.toLowerCase() : "";
}

/**
 * Sniffs a file's media type from its name + leading bytes. Returns null for
 * anything unsupported — the CALLER phrases the refusal (415 at intake,
 * skipped-with-reason inside a batch).
 */
export function sniffMediaType(filename: string, bytes: Uint8Array): SniffResult | null {
  const extension = extensionOf(filename);

  if (hasMagic(bytes, ZIP_MAGIC)) {
    // A ZIP is a ZIP whatever it is named — but only the .zip extension is an
    // intended batch; a renamed one is a mismatch the caller refuses.
    return extension === "zip" ? { mediaType: "application/zip" } : null;
  }

  const binary = looksBinary(bytes);
  if (binary) return null; // renamed binary or genuinely unsupported (e.g. PDF)

  switch (extension) {
    case "html":
    case "htm":
      return { mediaType: "text/html" };
    case "md":
    case "markdown":
      return { mediaType: "text/markdown" };
    case "txt":
      return { mediaType: "text/plain" };
    case "zip":
      return null; // .zip extension without ZIP magic: a renamed non-zip
    default:
      return null;
  }
}
