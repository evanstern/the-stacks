import { Database, KeyRound, RouteIcon, UploadCloud } from "lucide-react";
import { useEffect } from "react";
import { Form, useActionData, useNavigation, useRevalidator } from "react-router";

import type { Route } from "./+types/imports";
import { AppShell } from "~/components/app-shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getAuthMode, requireAuthenticated } from "~/lib/auth.server";
import type { ImportJob } from "~/lib/corpus/repository";
import { allowedUploadExtensions, maxUploadBytes } from "~/lib/imports/upload";
import { getImportDashboard, queueUploadImport, UploadValidationError } from "~/lib/imports/upload.server";
import { getImportJobObservability, isImportJobRunning } from "~/lib/import-observability";
import { getWorkspaceSummary } from "~/lib/workspace.server";

export const meta: Route.MetaFunction = () => [
  { title: "Imports · ikis.ai" },
  {
    name: "description",
    content: "Upload, inspect, and queue source material for the ikis.ai corpus.",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  return {
    authMode: getAuthMode(),
    imports: getImportDashboard(),
    workspace: getWorkspaceSummary(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  requireAuthenticated(request, { api: true });

  const formData = await request.formData();
  const upload = formData.get("source");
  const requestedPdfExtraction = formData.get("pdfExtraction");
  const pdfExtraction = requestedPdfExtraction === "docling" ? requestedPdfExtraction : "default";

  if (!(upload instanceof File)) {
    return { ok: false, message: "Choose a source file before importing." };
  }

  try {
    const result = await queueUploadImport(upload, { pdfExtraction });

    return {
      ok: true,
      duplicate: result.duplicate,
      message: result.message,
      importJobId: result.importJob.id,
      sourceId: result.source.id,
    };
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { ok: false, message: error.message };
    }

    throw error;
  }
}

function toneClass(tone: ReturnType<typeof getImportJobObservability>["statusTone"]): string {
  return {
    accent: "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]",
    muted: "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-card-foreground)]",
    primary: "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
    secondary: "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
  }[tone];
}

function ImportJobCard({ job }: { job: ImportJob }) {
  const observability = getImportJobObservability(job);
  const latestMessage = observability.latestError ?? observability.latestWarning;

  return (
    <a key={job.id} href={`/imports/${encodeURIComponent(job.id)}`} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-secondary)]">
      <span className="flex flex-wrap items-start justify-between gap-3">
        <span>
          <span className="block font-semibold text-[var(--color-card-foreground)]">{job.id}</span>
          <span className="mt-1 block">{job.adapter} · {job.adapterVersion}</span>
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${toneClass(observability.statusTone)}`}>
          {observability.statusLabel}
        </span>
      </span>
      <span className="mt-4 block h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${observability.progressPercent}%` }} />
      </span>
      <span className="mt-3 grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--color-muted-foreground)] md:grid-cols-2">
        <span>{observability.isRunning ? "Running" : "Elapsed"}: {observability.elapsedLabel}</span>
        <span>Updated {observability.lastUpdatedLabel}</span>
      </span>
      {observability.staleHint ? <span className="mt-3 block text-sm font-semibold text-[var(--color-accent)]">{observability.staleHint}</span> : null}
      {latestMessage ? <span className="mt-3 block text-sm leading-6 text-[var(--color-card-foreground)]">Latest {observability.latestError ? "error" : "warning"}: {latestMessage}</span> : null}
    </a>
  );
}

export default function Imports({ loaderData }: Route.ComponentProps) {
  const { authMode, imports, workspace } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isUploading = navigation.state !== "idle";
  const latestJob = imports.jobs[0];
  const revalidator = useRevalidator();
  const hasActiveJobs = imports.jobs.some(isImportJobRunning);

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const interval = window.setInterval(() => revalidator.revalidate(), 5000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, revalidator]);

  return (
    <AppShell>
      <main className="text-[var(--color-foreground)]">
      <section className="mx-auto grid max-w-6xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-[hsl(12_82%_48%_/_0.14)] blur-3xl" />
          <div className="relative">
            <Badge>Corpus intake</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              Imports
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              Bring source material into the workspace, inspect parser provenance, and send reviewable documents toward human approval.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <UploadCloud className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Upload source</CardTitle>
            </CardHeader>
            <div className="mt-4 grid gap-4">
              <Form method="post" encType="multipart/form-data" className="grid gap-3">
                <label className="grid gap-2 text-sm font-semibold text-[var(--color-card-foreground)]">
                  Corpus file
                  <input
                    data-testid="upload-input"
                    name="source"
                    type="file"
                    accept={allowedUploadExtensions.join(",")}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-muted-foreground)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-secondary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-secondary-foreground)]"
                  />
                </label>
                <fieldset className="grid gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm text-[var(--color-muted-foreground)]">
                  <legend className="px-1 font-semibold text-[var(--color-card-foreground)]">PDF extraction</legend>
                  <label className="flex items-center gap-2">
                    <input name="pdfExtraction" type="radio" value="default" defaultChecked />
                    Default parser / OCR fallback queue
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="pdfExtraction" type="radio" value="docling" />
                    Docling layout experiment (local 5174 prototype)
                  </label>
                </fieldset>
                <Button data-testid="upload-submit" type="submit" disabled={isUploading}>
                  {isUploading ? "Queueing..." : "Queue import"}
                </Button>
              </Form>
              <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">
                Accepts {allowedUploadExtensions.join(", ")} up to {Math.floor(maxUploadBytes / 1024 / 1024)} MB. Uploads are SHA-256 hashed once per parser path.
              </p>
              <div
                data-testid="import-status"
                className="rounded-2xl border border-[var(--color-border)] bg-[hsl(41_23%_84%_/_0.42)] px-4 py-3 text-sm leading-6 text-[var(--color-card-foreground)]"
                role="status"
              >
                {actionData?.message ?? (latestJob ? `Latest import job ${latestJob.id} is ${latestJob.status}.` : "No imports queued yet.")}
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <Database className="h-5 w-5 text-[var(--color-primary)]" />
                <CardTitle>{workspace.storeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                Runtime truth belongs behind `app/lib/*` boundaries; no MongoDB data access is scaffolded here.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <KeyRound className="h-5 w-5 text-[var(--color-primary)]" />
                <CardTitle>{authMode.label}</CardTitle>
              </CardHeader>
              <CardContent>{authMode.description}</CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <RouteIcon className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <div className="mt-4 grid gap-3 text-sm text-[var(--color-muted-foreground)]">
              {imports.sources.length > 0 ? (
                imports.sources.slice(0, 5).map((source) => (
                  <a key={source.id} href={`/sources/${encodeURIComponent(source.id)}`} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-colors hover:bg-[var(--color-secondary)]">
                    <span className="block font-semibold text-[var(--color-card-foreground)]">{source.originalFilename}</span>
                    <span className="mt-1 block">{source.importStatus} · {source.parserAdapter} · {source.fileHash.slice(0, 12)}</span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.16em]">Open source material →</span>
                  </a>
                ))
              ) : (
                <p>No uploaded sources yet.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader>
              <RouteIcon className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Import jobs</CardTitle>
            </CardHeader>
            <div className="mt-4 grid gap-3 text-sm text-[var(--color-muted-foreground)]">
              {imports.jobs.length > 0 ? (
                imports.jobs.slice(0, 5).map((job) => <ImportJobCard key={job.id} job={job} />)
              ) : (
                <p>No import jobs queued yet.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
      </main>
    </AppShell>
  );
}
