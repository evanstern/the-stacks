// Pure helpers for scripts/check-spec-scope.mjs (spec 122): the CI equivalent of the
// root-guard hook's scope rule. A PR may only touch paths its linked spec declares.
// Scope is declared by a `Scope-Paths:` line in spec.md (comma-separated, backticks
// optional; a trailing `/` means "the whole directory"). Without one, path-looking
// backtick tokens in the `## Scope` section are used. With neither, the check WARNS.

export const ALWAYS_ALLOWED = ["backlog/", "docs/wiki/"];

const SPEC_DIR = /^specs\/(\d{3}-[^/]+)\//;

export function specDirsTouched(files) {
  const dirs = new Set();
  for (const f of files) {
    const m = SPEC_DIR.exec(f);
    if (m) dirs.add(`specs/${m[1]}`);
  }
  return [...dirs].sort();
}

const looksLikePath = (t) =>
  !/\s/.test(t) && (t.includes("/") || /\.[a-z0-9]+$/i.test(t));

export function declaredScope(specMd) {
  const line = /^\**Scope-Paths\**:\**\s*(.+)$/m.exec(specMd);
  if (line) {
    const paths = line[1]
      .split(",")
      .map((s) => s.trim().replace(/^`|`$/g, ""))
      .filter(Boolean);
    return { source: "Scope-Paths", paths };
  }
  const sec = /^## Scope\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(specMd);
  if (!sec) return { source: null, paths: [] };
  const paths = [...sec[1].matchAll(/`([^`\n]+)`/g)]
    .map((m) => m[1])
    .filter(looksLikePath);
  return {
    source: paths.length ? "Scope section" : null,
    paths: [...new Set(paths)],
  };
}

export const inScope = (file, paths) =>
  paths.some((p) =>
    p.endsWith("/")
      ? file.startsWith(p)
      : file === p || file.startsWith(`${p}/`),
  );

/** -> { status: "pass"|"fail"|"warn", message, offenders } */
export function evaluate({ files, readSpec }) {
  const dirs = specDirsTouched(files);
  if (dirs.length !== 1) {
    return {
      status: "warn",
      offenders: [],
      message:
        dirs.length === 0
          ? "no spec dir touched by this PR; scope not derivable (advisory)"
          : `PR touches ${dirs.length} spec dirs (${dirs.join(", ")}); scope not derivable (advisory)`,
    };
  }
  const dir = dirs[0];
  const { source, paths } = declaredScope(readSpec(dir));
  if (!source) {
    return {
      status: "warn",
      offenders: [],
      message: `${dir}/spec.md declares no scope paths (advisory)`,
    };
  }
  const allowed = [...paths, ...ALWAYS_ALLOWED, `${dir}/`];
  const offenders = files.filter((f) => !inScope(f, allowed));
  return offenders.length
    ? {
        status: "fail",
        offenders,
        message: `${offenders.length} path(s) outside ${dir} scope (${source})`,
      }
    : {
        status: "pass",
        offenders: [],
        message: `all ${files.length} path(s) within ${dir} scope (${source})`,
      };
}
