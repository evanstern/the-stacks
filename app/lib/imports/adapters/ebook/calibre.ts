import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CalibreFallbackResult = {
  text: string;
  warnings: string[];
};

export function isCalibreFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.IKIS_EBOOK_CALIBRE_FALLBACK === "1" || env.IKIS_EBOOK_CALIBRE_FALLBACK === "true";
}

export async function tryCalibreTextFallback(input: { filename: string; bytes: Uint8Array }, env: NodeJS.ProcessEnv = process.env): Promise<CalibreFallbackResult | null> {
  if (!isCalibreFallbackEnabled(env)) {
    return null;
  }

  const workdir = await mkdtemp(join(tmpdir(), "ikis-ebook-calibre-"));
  const sourcePath = join(workdir, input.filename.replace(/[/\\]/g, "_"));
  const outputPath = join(workdir, "output.txt");

  try {
    await writeFile(sourcePath, input.bytes);
    await execFileAsync("ebook-convert", [sourcePath, outputPath], { timeout: 30_000, maxBuffer: 1024 * 1024 });
    return {
      text: (await readFile(outputPath, "utf8")).replace(/^\uFEFF/, "").trim(),
      warnings: ["text extracted using optional Calibre ebook-convert fallback"],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { text: "", warnings: [`optional Calibre fallback failed or is unavailable: ${message}`] };
  } finally {
    await rm(workdir, { force: true, recursive: true });
  }
}
