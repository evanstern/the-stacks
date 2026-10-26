import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import ts from "typescript";

/**
 * Import-graph checker for the write boundary
 * (specs/029-proposal-gate/contracts/write-boundary.md, AC #1).
 */

export type BoundaryRule =
  | "writer-import"
  | "dynamic-import-not-literal"
  | "model-reach";

export interface BoundaryViolation {
  /** Path of the offending file, relative to the checked root, posix style. */
  file: string;
  rule: BoundaryRule;
  detail: string;
}

interface ImportRef {
  /** Resolved module path relative to root, or the raw specifier if not relative. */
  target: string;
  /** Named bindings, or "*" for a namespace import / `export *`. */
  names: string[];
}

const LOG = "events/log.ts";
const SESSION = "session/events.ts";

/** Writer binding -> module that exports it. */
const WRITER_BINDINGS: Record<string, string> = {
  append: LOG,
  appendBatch: LOG,
  appendSessionEvent: SESSION,
  appendSessionEvents: SESSION,
  appendMechanicsBatch: SESSION,
  appendUncataloguedEvent: SESSION,
};

/** Allowed importer predicate per writer binding. */
const ALLOWED: Record<string, (file: string) => boolean> = {
  append: (f) => f === SESSION,
  appendBatch: (f) => f === SESSION,
  appendSessionEvent: (f) => f.startsWith("gate/"),
  appendSessionEvents: (f) => f.startsWith("gate/"),
  appendMechanicsBatch: (f) => f.startsWith("gate/"),
  appendUncataloguedEvent: (f) => f === "ws/gateway.ts",
};

function isWriterModule(file: string): boolean {
  return (
    file.startsWith("session/") ||
    file.startsWith("gate/") ||
    file === "ws/gateway.ts"
  );
}

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTs(full));
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function resolveSpecifier(
  root: string,
  fromFile: string,
  spec: string,
): string {
  if (!spec.startsWith(".")) return spec;
  const joined = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const base = joined.replace(/\.(js|ts)$/, "");
  if (existsSync(join(root, `${base}.ts`))) return `${base}.ts`;
  if (existsSync(join(root, base, "index.ts"))) return `${base}/index.ts`;
  // Unresolved (e.g. the violation tree): keep the conventional name.
  return `${base}.ts`;
}

function parseFile(
  root: string,
  file: string,
): { refs: ImportRef[]; badDynamic: string[] } {
  const source = readFileSync(join(root, file), "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const refs: ImportRef[] = [];
  const badDynamic: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = resolveSpecifier(root, file, node.moduleSpecifier.text);
      const names: string[] = [];
      const clause = node.importClause;
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) names.push("*");
        else
          for (const el of clause.namedBindings.elements)
            names.push((el.propertyName ?? el.name).text);
      }
      if (clause?.name) names.push("default");
      refs.push({ target, names });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = resolveSpecifier(root, file, node.moduleSpecifier.text);
      const names: string[] = [];
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements)
          names.push((el.propertyName ?? el.name).text);
      } else names.push("*");
      refs.push({ target, names });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteralLike(arg)) {
        refs.push({
          target: resolveSpecifier(root, file, arg.text),
          names: ["*"],
        });
      } else {
        badDynamic.push(source.slice(node.getStart(sf), node.getEnd()));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { refs, badDynamic };
}

/** Checks the write boundary over the `src`-shaped tree at `root`. */
export function checkWriteBoundary(root: string): BoundaryViolation[] {
  const files = listTs(root).map((f) => relative(root, f).split(sep).join("/"));
  const graph = new Map<string, ImportRef[]>();
  const violations: BoundaryViolation[] = [];
  const dynamicBy = new Map<string, string[]>();
  /** Files reachable from any writer module: where an untraceable import() would blind rule 4. */
  const reachable = new Set<string>();

  for (const file of files) {
    const { refs, badDynamic } = parseFile(root, file);
    graph.set(file, refs);
    if (badDynamic.length > 0) dynamicBy.set(file, badDynamic);
    // Rule 3: writer bindings only from allowed importers.
    for (const ref of refs) {
      const exported = Object.entries(WRITER_BINDINGS).filter(
        ([, mod]) => mod === ref.target,
      );
      for (const [binding] of exported) {
        const imported = ref.names.includes("*") || ref.names.includes(binding);
        if (imported && !ALLOWED[binding](file)) {
          violations.push({
            file,
            rule: "writer-import",
            detail: `${binding} from ${ref.target}`,
          });
        }
      }
    }
  }

  // Rule 4: no writer module reaches ai/ through its import closure.
  for (const file of files.filter(isWriterModule)) {
    const seen = new Set<string>([file]);
    reachable.add(file);
    const queue = [file];
    let reached: string | undefined;
    while (queue.length > 0 && !reached) {
      const cur = queue.shift() as string;
      for (const ref of graph.get(cur) ?? []) {
        if (ref.target.startsWith("ai/")) {
          reached = ref.target;
          break;
        }
        if (!seen.has(ref.target) && graph.has(ref.target)) {
          seen.add(ref.target);
          reachable.add(ref.target);
          queue.push(ref.target);
        }
      }
    }
    if (reached) {
      violations.push({
        file,
        rule: "model-reach",
        detail: `reaches ${reached}`,
      });
    }
  }
  for (const [file, codes] of dynamicBy) {
    if (!reachable.has(file)) continue;
    for (const code of codes) {
      violations.push({
        file,
        rule: "dynamic-import-not-literal",
        detail: code,
      });
    }
  }
  return violations;
}
