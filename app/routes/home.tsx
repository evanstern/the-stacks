import { ArrowUpRight, Database, KeyRound, RouteIcon, UploadCloud } from "lucide-react";
import { Form, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/home";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getAuthMode, requireAuthenticated } from "~/lib/auth.server";
import { allowedUploadExtensions, maxUploadBytes } from "~/lib/imports/upload";
import { getImportDashboard, queueUploadImport, UploadValidationError } from "~/lib/imports/upload.server";
import { getWorkspaceSummary } from "~/lib/workspace.server";

export const meta: Route.MetaFunction = () => [
  { title: "ikis.ai" },
  {
    name: "description",
    content:
      "ikis.ai is a self-hosted corpus workspace for grounded conversation.",
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

  if (!(upload instanceof File)) {
    return { ok: false, message: "Choose a source file before importing." };
  }

  try {
    const result = await queueUploadImport(upload);

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

export default function Home({ loaderData }: Route.ComponentProps) {
  const { authMode, imports, workspace } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isUploading = navigation.state !== "idle";
  const latestJob = imports.jobs[0];

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl content-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-12">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(166_64%_24%_/_0.15)] blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-[hsl(12_82%_48%_/_0.15)] blur-3xl" />
          <div className="relative">
            <Badge>React Router 7 scaffold</Badge>
            <h1 className="mt-6 max-w-3xl font-[var(--font-display)] text-5xl font-bold leading-[0.96] tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-7xl">
              ikis.ai
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-[var(--color-muted-foreground)]">
              A single-user, self-hosted corpus workspace with a canonical SQLite
              or libSQL boundary, grounded conversation, and cited context packs.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted-foreground)]">
              The Stacks remains the internal codebase lineage; this public
              workspace can later sit naturally at thestacks.ikis.ai.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a href="/" aria-label="Open the workspace home route">
                  Workspace ready
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a href="/review" aria-label="Open the human review queue">
                  Review queue
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a href="/chat" aria-label="Open grounded corpus chat">
                  Ask Ikis
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
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
                <Button data-testid="upload-submit" type="submit" disabled={isUploading}>
                  {isUploading ? "Queueing..." : "Queue import"}
                </Button>
              </Form>
              <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">
                Accepts {allowedUploadExtensions.join(", ")} up to {Math.floor(maxUploadBytes / 1024 / 1024)} MB. Uploads are SHA-256 hashed and stored once.
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
          <Card>
            <CardHeader>
              <Database className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>{workspace.storeLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              Runtime truth belongs behind `app/lib/*` boundaries; no MongoDB
              data access is scaffolded here.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <RouteIcon className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Thin routes</CardTitle>
            </CardHeader>
            <CardContent>
              `app/routes.ts` owns the URL map, while route modules compose
              feature libraries and UI primitives.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <KeyRound className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>{authMode.label}</CardTitle>
            </CardHeader>
            <CardContent>{authMode.description}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <RouteIcon className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <div className="mt-4 grid gap-3 text-sm text-[var(--color-muted-foreground)]">
              {imports.sources.length > 0 ? (
                imports.sources.slice(0, 5).map((source) => (
                  <div key={source.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                    <p className="font-semibold text-[var(--color-card-foreground)]">{source.originalFilename}</p>
                    <p>{source.importStatus} · {source.parserAdapter} · {source.fileHash.slice(0, 12)}</p>
                  </div>
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
                imports.jobs.slice(0, 5).map((job) => (
                  <a key={job.id} href={`/imports/${encodeURIComponent(job.id)}`} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-colors hover:bg-[var(--color-secondary)]">
                    <p className="font-semibold text-[var(--color-card-foreground)]">{job.id}</p>
                    <p>{job.status} · {job.adapter} · {job.adapterVersion}</p>
                  </a>
                ))
              ) : (
                <p>No import jobs queued yet.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
