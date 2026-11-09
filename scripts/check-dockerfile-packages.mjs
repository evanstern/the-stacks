// Fails when a workspace package that apps/server depends on (transitively,
// via @the-stacks/* dependencies) is missing from the Dockerfile's runtime
// stage: its package.json COPY line or its dist COPY line. TASK-0303.
// Run by `pnpm check:scripts` through check-dockerfile-packages-lib.test.mjs.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Workspace packages (dir name -> package.json) under packages/ and apps/.
export function workspacePackages(root) {
  const byName = new Map();
  for (const dir of ["packages", "apps"]) {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `${dir}/${entry.name}`;
      const pkg = JSON.parse(
        readFileSync(join(root, rel, "package.json"), "utf8"),
      );
      byName.set(pkg.name, { rel, deps: Object.keys(pkg.dependencies ?? {}) });
    }
  }
  return byName;
}

// Every workspace package reachable from `start` via runtime dependencies.
export function serverClosure(byName, start = "@the-stacks/server") {
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name) || !byName.has(name)) return;
    seen.add(name);
    for (const dep of byName.get(name).deps) visit(dep);
  };
  visit(start);
  return [...seen].map((name) => ({ name, ...byName.get(name) }));
}

// Lines of the runtime stage only (from `FROM base AS runtime` on).
export function runtimeStage(dockerfile) {
  const i = dockerfile.indexOf("FROM base AS runtime");
  return i === -1 ? "" : dockerfile.slice(i);
}

// Returns human-readable problems; an empty array means the Dockerfile passes.
export function missingCopies(dockerfile, root) {
  const runtime = runtimeStage(dockerfile);
  const problems = [];
  for (const { name, rel } of serverClosure(workspacePackages(root))) {
    if (!runtime.includes(`COPY ${rel}/package.json ${rel}/package.json`))
      problems.push(`${name}: missing runtime COPY ${rel}/package.json`);
    if (
      rel.startsWith("packages/") &&
      !runtime.includes(`COPY --from=build /app/${rel}/dist ${rel}/dist`)
    )
      problems.push(
        `${name}: missing runtime COPY --from=build /app/${rel}/dist`,
      );
  }
  return problems;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const problems = missingCopies(
    readFileSync(join(root, "Dockerfile"), "utf8"),
    root,
  );
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(
    "Dockerfile runtime stage covers every server workspace package.",
  );
}
