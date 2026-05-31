import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

import type { CorpusReadiness, ImportAdapter, ImportAdapterResult, ImportWarning, NormalizedDocument, NormalizedSection } from "./types.js";
import { normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "./shared.js";
import type { JsonValue } from "../../db/rows.js";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

type DoclingAdapterOptions = {
  runCommand?: CommandRunner;
};

type DoclingMetrics = {
  characterCount: number;
  headingCount: number;
  markdownTableCount: number;
  statBlockHintCount: number;
  jsonItemCount: number | null;
};

const commandTimeoutMs = 300_000;

export const doclingPdfImportAdapter = createDoclingPdfImportAdapter();

export function createDoclingPdfImportAdapter(options: DoclingAdapterOptions = {}): ImportAdapter {
  const execute = options.runCommand ?? runCommand;
  const doclingCommand = process.env.IKIS_DOCLING_COMMAND ?? "/opt/docling/bin/docling";

  return {
    name: "pdf-docling",
    version: "pdf-docling-v1",
    async import(input): Promise<ImportAdapterResult> {
      const workDir = await mkdtemp(join(tmpdir(), "ikis-docling-"));

      try {
        const pdfPath = join(workDir, safePdfName(input.filename));
        const outputDir = join(workDir, "out");
        await writeFile(pdfPath, input.bytes);

        const version = await execute(doclingCommand, ["--version"]);
        const converted = await execute(doclingCommand, [pdfPath, "--from", "pdf", "--to", "md", "--to", "json", "--ocr-engine", "tesseract", "--output", outputDir]);
        const artifacts = await readDoclingArtifacts(outputDir);
        const normalizedText = trimBlankLines(normalizeLineEndings(artifacts.markdown));
        const metrics = analyzeDoclingOutput(normalizedText, artifacts.json);
        const readiness = classifyDoclingReadiness(metrics);
        const warnings: ImportWarning[] = [];

        if (converted.stderr.trim().length > 0) {
          warnings.push({ code: "docling-stderr", message: converted.stderr.trim() });
        }

        if (readiness.state !== "usable") {
          warnings.push({ code: "docling-corpus-readiness", message: readiness.reason, metadata: readiness.evidence });
        }

        return {
          documents: [createDoclingDocument({
            filename: input.filename,
            sourceId: input.sourceId,
            normalizedText,
            json: artifacts.json,
            markdownArtifact: artifacts.markdownFile,
            jsonArtifact: artifacts.jsonFile,
            engineVersion: firstNonEmptyLine(version.stdout || version.stderr),
            readiness,
            metrics,
          })],
          warnings,
        };
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    },
  };
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${commandTimeoutMs}ms during Docling PDF extraction.`));
    }, commandTimeoutMs);

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      callback();
    };

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => settle(() => reject(new Error(`${command} is not available for Docling PDF extraction: ${error.message}`))));
    child.on("close", (code) => {
      const result = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };

      if (code === 0) {
        settle(() => resolve(result));
        return;
      }

      settle(() => reject(new Error(`${command} failed for Docling PDF extraction with exit code ${code ?? "unknown"}: ${result.stderr.trim() || result.stdout.trim() || "no output"}`)));
    });
  });
}

function safePdfName(filename: string): string {
  const base = basename(filename, extname(filename)).replace(/[^a-zA-Z0-9._-]/g, "-") || "source";
  return `${base}.pdf`;
}

async function readDoclingArtifacts(outputDir: string): Promise<{ markdown: string; json: JsonValue; markdownFile: string | null; jsonFile: string | null }> {
  const files = await readdir(outputDir, { recursive: true });
  const markdownFile = files.find((file) => typeof file === "string" && /\.md$/i.test(file))?.toString() ?? null;
  const jsonFile = files.find((file) => typeof file === "string" && /\.json$/i.test(file))?.toString() ?? null;

  if (!markdownFile) {
    throw new Error("Docling did not emit a Markdown artifact for the PDF.");
  }

  const markdown = await readFile(join(outputDir, markdownFile), "utf8");
  const json = jsonFile ? JSON.parse(await readFile(join(outputDir, jsonFile), "utf8")) as JsonValue : null;

  return { markdown, json, markdownFile, jsonFile };
}

function createDoclingDocument(input: {
  filename: string;
  sourceId?: string;
  normalizedText: string;
  json: JsonValue;
  markdownArtifact: string | null;
  jsonArtifact: string | null;
  engineVersion: string | null;
  readiness: CorpusReadiness;
  metrics: DoclingMetrics;
}): NormalizedDocument {
  return {
    id: "document-docling-0001",
    title: titleFromFilename(input.filename),
    authors: [],
    language: null,
    sourceFormat: "pdf",
    provenance: {
      filename: input.filename,
      sourceId: input.sourceId ?? null,
      extraction: "docling-layout",
      docling: {
        engine: "docling",
        engineVersion: input.engineVersion,
        artifacts: { markdown: input.markdownArtifact, json: input.jsonArtifact },
        metrics: input.metrics,
      },
      corpusReadiness: input.readiness,
    },
    rawMetadata: {
      corpusReadiness: input.readiness,
      docling: {
        engineVersion: input.engineVersion,
        metrics: input.metrics,
        json: input.json,
      },
      limitations: [
        "Docling extraction is an experimental local/self-hosted path for layout-aware PDFs.",
        "Markdown tables and Docling JSON are preserved for review, but approval remains a human decision.",
      ],
    },
    normalizedText: input.normalizedText,
    sections: createDoclingSections(input.normalizedText, input.metrics),
    corpusReadiness: input.readiness,
  };
}

function analyzeDoclingOutput(markdown: string, json: JsonValue): DoclingMetrics {
  const headingCount = markdown.split(/\r?\n/).filter((line) => /^#{1,6}\s+\S/.test(line.trim())).length;
  const markdownTableCount = Array.from(markdown.matchAll(/^\s*\|.+\|\s*$/gm)).length;
  const statBlockHintCount = Array.from(markdown.matchAll(/\b(?:Armor Class|Hit Points|Speed|STR|DEX|CON|INT|WIS|CHA|Challenge)\b/gi)).length;

  return {
    characterCount: markdown.trim().length,
    headingCount,
    markdownTableCount,
    statBlockHintCount,
    jsonItemCount: countDoclingJsonItems(json),
  };
}

function countDoclingJsonItems(value: JsonValue): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value.texts ?? value.tables ?? value.pages;
  return Array.isArray(candidate) ? candidate.length : null;
}

function classifyDoclingReadiness(metrics: DoclingMetrics): CorpusReadiness {
  const evidence = metrics as unknown as JsonValue;

  if (metrics.characterCount < 24) {
    return {
      state: "deferred",
      reason: "Docling emitted too little text to trust for corpus search and review.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  return {
    state: "usable",
    reason: "Docling emitted local layout-aware Markdown/JSON that is fit for human review.",
    reviewRecommendation: "approve",
    evidence,
  };
}

function createDoclingSections(normalizedText: string, metrics: DoclingMetrics): NormalizedSection[] {
  const blocks = splitMarkdownIntoSections(normalizedText);
  const sections: NormalizedSection[] = [];
  let searchOffset = 0;

  for (const block of blocks) {
    const startOffset = normalizedText.indexOf(block.text, searchOffset);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
    const endOffset = safeStartOffset + block.text.length;
    searchOffset = endOffset;
    sections.push({
      id: sectionId("pdf-docling-section", sections.length),
      ordinal: sections.length,
      parentSectionId: null,
      heading: block.heading,
      headingPath: block.heading ? [block.heading] : [],
      startOffset: safeStartOffset,
      endOffset,
      text: block.text,
      metadata: {
        source: "pdf-docling-markdown",
        heading: block.heading,
        containsMarkdownTable: /^\s*\|.+\|\s*$/m.test(block.text),
        containsStatBlockHints: /\b(?:Armor Class|Hit Points|Speed|STR|DEX|CON|INT|WIS|CHA|Challenge)\b/i.test(block.text),
        documentMetrics: metrics,
      },
    });
  }

  return sections;
}

function splitMarkdownIntoSections(markdown: string): Array<{ heading: string | null; text: string }> {
  const lines = markdown.split("\n");
  const sections: Array<{ heading: string | null; text: string }> = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line)?.[1] ?? null;

    if (heading && currentLines.length > 0) {
      sections.push({ heading: currentHeading, text: trimBlankLines(currentLines.join("\n")) });
      currentLines = [];
    }

    if (heading) {
      currentHeading = heading;
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, text: trimBlankLines(currentLines.join("\n")) });
  }

  return sections.filter((section) => section.text.length > 0);
}

function firstNonEmptyLine(output: string): string | null {
  return output.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? null;
}
