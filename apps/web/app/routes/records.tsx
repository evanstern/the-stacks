import type { ReactNode } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";

import { Card } from "@/components/ui/card";
import {
  getJobEvents,
  getRecordsStats,
  listChunks,
  listJobs,
  listRetrievalRuns,
  listSourceChunks,
  listSources,
  listUploads,
  type ChunkRecord,
  type IngestionEvent,
  type IngestionJob,
  type RecordsStats,
  type RetrievalRun,
  type SourceRecord,
  type UploadRecord,
} from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type RecordsLoaderData = {
  uploads: UploadRecord[];
  jobs: IngestionJob[];
  selectedJob: IngestionJob | null;
  selectedJobEvents: IngestionEvent[];
  retrievalRuns: RetrievalRun[];
  sources: SourceRecord[];
  chunks: ChunkRecord[];
  sourceChunks: ChunkRecord[];
  stats: RecordsStats;
};

type RecordsSection = "overview" | "uploads" | "jobs" | "sources" | "retrieval" | "chunks";

type TabDefinition = {
  id: RecordsSection;
  label: string;
  count: number;
};

const recordsSections: RecordsSection[] = ["overview", "uploads", "jobs", "sources", "retrieval", "chunks"];

export async function recordsLoader({ request }: { request: Request }): Promise<RecordsLoaderData> {
  await requireAuth();
  const url = new URL(request.url);
  const requestedJobId = url.searchParams.get("job");
  const requestedSourceId = url.searchParams.get("source");
  const [uploads, jobs, retrievalRuns, sources, chunks, stats] = await Promise.all([
    listUploads(),
    listJobs(),
    listRetrievalRuns(),
    listSources(),
    listChunks(),
    getRecordsStats(),
  ]);
  const selectedJob = (requestedJobId ? jobs.find((job) => job.id === requestedJobId) : null) ?? jobs[0] ?? null;
  const selectedSource = findSource(sources, requestedSourceId) ?? sources[0] ?? null;
  const selectedJobEvents = selectedJob ? await getJobEvents(selectedJob.id) : [];
  const sourceChunks = selectedSource ? await listSourceChunks(selectedSource.id) : [];

  return { uploads, jobs, selectedJob, selectedJobEvents, retrievalRuns, sources, chunks, sourceChunks, stats };
}

export function RecordsRoute() {
  const { uploads, jobs, selectedJob, selectedJobEvents, retrievalRuns, sources, chunks, sourceChunks, stats } = useLoaderData() as RecordsLoaderData;
  const [searchParams] = useSearchParams();
  const activeSection = getSection(searchParams.get("section"));
  const selectedUpload = findById(uploads, searchParams.get("upload")) ?? uploads[0] ?? null;
  const selectedJobFromQuery = findById(jobs, searchParams.get("job")) ?? selectedJob;
  const selectedSource = findSource(sources, searchParams.get("source")) ?? sources[0] ?? null;
  const selectedRetrieval = findById(retrievalRuns, searchParams.get("retrieval")) ?? retrievalRuns[0] ?? null;
  const selectedChunk = findById(chunks, searchParams.get("chunk")) ?? chunks[0] ?? null;
  const latestUpload = uploads[0] ?? null;
  const latestJob = jobs[0] ?? null;
  const latestSource = sources[0] ?? null;

  const tabs: TabDefinition[] = [
    { id: "overview", label: "Overview", count: stats.uploads + stats.jobs + stats.sources + stats.retrieval_runs + stats.chunks },
    { id: "uploads", label: "Uploads", count: stats.uploads },
    { id: "jobs", label: "Jobs", count: stats.jobs },
    { id: "sources", label: "Sources", count: stats.sources },
    { id: "retrieval", label: "Retrieval", count: stats.retrieval_runs },
    { id: "chunks", label: "Chunks", count: stats.chunks },
  ];

  return (
    <div className="records-page">
      <section className="records-shell">
        <div className="records-hero">
          <div className="records-hero-grid">
            <div>
              <p className="micro-label text-clay-dark">Records observability</p>
              <h1 className="mt-2 font-serif text-4xl tracking-[-0.05em] text-foreground">Inspect the ingestion trail.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Tabbed records keep the persisted upload, worker, retrieval, source, and chunk state scannable without leaving the page.
              </p>
            </div>
            <div className="records-metrics">
              <Metric label="Uploads" value={stats.uploads} />
              <Metric label="Jobs" value={stats.jobs} />
              <Metric label="Sources" value={stats.sources} />
              <Metric label="Runs" value={stats.retrieval_runs} />
              <Metric label="Chunks" value={stats.chunks} />
              <Metric label="Indexed" value={stats.indexed_chunks} />
            </div>
          </div>
        </div>
        <nav className="records-tabs" aria-label="Records sections">
          {tabs.map((tab) => (
            <TabLink key={tab.id} tab={tab} active={activeSection === tab.id} />
          ))}
        </nav>
      </section>

      {activeSection === "overview" ? (
        <OverviewSection
          uploads={uploads}
          jobs={jobs}
          selectedJob={selectedJob}
          selectedJobEvents={selectedJobEvents}
          retrievalRuns={retrievalRuns}
          sources={sources}
          chunks={chunks}
          latestUpload={latestUpload}
          latestJob={latestJob}
          latestSource={latestSource}
        />
      ) : null}
      {activeSection === "uploads" ? <UploadsSection uploads={uploads} jobs={jobs} sources={sources} selectedUpload={selectedUpload} /> : null}
      {activeSection === "jobs" ? <JobsSection jobs={jobs} selectedJob={selectedJobFromQuery} events={selectedJobEvents} /> : null}
      {activeSection === "sources" ? <SourcesSection sources={sources} uploads={uploads} sourceChunks={sourceChunks} selectedSource={selectedSource} /> : null}
      {activeSection === "retrieval" ? <RetrievalSection retrievalRuns={retrievalRuns} selectedRetrieval={selectedRetrieval} /> : null}
      {activeSection === "chunks" ? <ChunksSection chunks={chunks} sources={sources} selectedChunk={selectedChunk} /> : null}
    </div>
  );
}

function OverviewSection({
  uploads,
  jobs,
  selectedJob,
  selectedJobEvents,
  retrievalRuns,
  sources,
  chunks,
  latestUpload,
  latestJob,
  latestSource,
}: {
  uploads: UploadRecord[];
  jobs: IngestionJob[];
  selectedJob: IngestionJob | null;
  selectedJobEvents: IngestionEvent[];
  retrievalRuns: RetrievalRun[];
  sources: SourceRecord[];
  chunks: ChunkRecord[];
  latestUpload: UploadRecord | null;
  latestJob: IngestionJob | null;
  latestSource: SourceRecord | null;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Latest upload" empty="No uploads yet." href={latestUpload ? sectionHref("uploads", "upload", latestUpload.id) : undefined}>
          {latestUpload ? (
            <MetadataGrid>
              <MetaItem label="Name" value={latestUpload.original_filename} />
              <MetaItem label="Size" value={formatBytes(latestUpload.size_bytes)} />
              <MetaItem label="Type" value={latestUpload.content_type} />
              <MetaItem label="Created" value={formatDate(latestUpload.created_at)} />
              <MetaItem label="Upload id" value={latestUpload.id} mono />
              <MetaItem label="SHA" value={latestUpload.sha256} mono />
            </MetadataGrid>
          ) : null}
        </SummaryCard>
        <SummaryCard title="Latest job" empty="No jobs queued yet." href={latestJob ? sectionHref("jobs", "job", latestJob.id) : undefined}>
          {latestJob ? <JobMeta job={latestJob} compact /> : null}
        </SummaryCard>
        <SummaryCard title="Latest source" empty="No indexed sources yet." href={latestSource ? sectionHref("sources", "source", latestSource.id) : undefined}>
          {latestSource ? <SourceMeta source={latestSource} /> : null}
        </SummaryCard>
        <SummaryCard title="Latest retrieval" empty="No retrieval runs yet." href={retrievalRuns[0] ? sectionHref("retrieval", "retrieval", retrievalRuns[0].id) : undefined}>
          {retrievalRuns[0] ? <RetrievalMeta run={retrievalRuns[0]} /> : null}
        </SummaryCard>
      </div>
      <Card className="rounded-xl p-4 shadow-none">
        <PanelHeader title="Newest job events" count={selectedJobEvents.length} />
        {selectedJob ? (
          <p className="mt-2 break-all font-mono text-[0.68rem] text-muted">job {selectedJob.id}</p>
        ) : null}
        <EventList events={selectedJobEvents} empty={jobs.length ? "No events recorded for the newest job." : "Upload a source to see job events."} />
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <CompactStat label="Known uploads" value={uploads.length} />
          <CompactStat label="Retrieval runs" value={retrievalRuns.length} />
          <CompactStat label="Source chunks" value={sumChunks(sources)} />
          <CompactStat label="Preview chunks" value={chunks.length} />
        </div>
      </Card>
    </div>
  );
}

function UploadsSection({ uploads, jobs, sources, selectedUpload }: { uploads: UploadRecord[]; jobs: IngestionJob[]; sources: SourceRecord[]; selectedUpload: UploadRecord | null }) {
  const uploadJobs = selectedUpload ? jobs.filter((job) => job.upload_id === selectedUpload.id) : [];
  const uploadSource = selectedUpload ? sources.find((source) => source.upload_id === selectedUpload.id) ?? null : null;

  return (
    <RecordSplit
      list={
        <RecordList title="Uploads" count={uploads.length} empty="No uploads yet.">
          {uploads.map((upload) => (
            <DenseRow
              key={upload.id}
              href={sectionHref("uploads", "upload", upload.id)}
              active={selectedUpload?.id === upload.id}
              eyebrow={upload.extension || "file"}
              title={upload.original_filename}
              detail={`${formatBytes(upload.size_bytes)} · ${upload.content_type}`}
              meta={[`id ${shortId(upload.id)}`, formatDate(upload.created_at), `sha ${shortId(upload.sha256)}`]}
            />
          ))}
        </RecordList>
      }
      detail={
        <DetailPanel title="Upload detail" empty="Select an upload to inspect persisted metadata." item={selectedUpload}>
          {(upload) => (
            <div className="space-y-4">
              <MetadataGrid>
                <MetaItem label="Upload id" value={upload.id} mono />
                <MetaItem label="File" value={upload.original_filename} />
                <MetaItem label="Extension" value={upload.extension} />
                <MetaItem label="Content type" value={upload.content_type} />
                <MetaItem label="Size" value={formatBytes(upload.size_bytes)} />
                <MetaItem label="Created" value={formatDate(upload.created_at)} />
                <MetaItem label="SHA-256" value={upload.sha256} mono />
              </MetadataGrid>
              <RelationshipRail>
                <RelationshipLink label="Jobs for upload" value={uploadJobs.length} href={uploadJobs[0] ? sectionHref("jobs", "job", uploadJobs[0].id) : undefined} />
                <RelationshipLink label="Source record" value={uploadSource ? uploadSource.original_filename : "none"} href={uploadSource ? sectionHref("sources", "source", uploadSource.id) : undefined} />
              </RelationshipRail>
            </div>
          )}
        </DetailPanel>
      }
    />
  );
}

function JobsSection({ jobs, selectedJob, events }: { jobs: IngestionJob[]; selectedJob: IngestionJob | null; events: IngestionEvent[] }) {
  return (
    <RecordSplit
      list={
        <RecordList title="Jobs" count={jobs.length} empty="No jobs queued yet.">
          {jobs.map((job) => (
            <DenseRow
              key={job.id}
              href={sectionHref("jobs", "job", job.id)}
              active={selectedJob?.id === job.id}
              eyebrow={job.status}
              title={`job ${shortId(job.id)}`}
              detail={`upload ${shortId(job.upload_id)} · updated ${formatDate(job.updated_at)}`}
              meta={[`created ${formatDate(job.created_at)}`, job.error_summary ? "has error" : "no error summary"]}
            />
          ))}
        </RecordList>
      }
      detail={
        <DetailPanel title="Job detail" empty="Select a job to inspect status, upload relationship, and available events." item={selectedJob}>
          {(job) => (
            <div className="space-y-4">
              <JobMeta job={job} />
              <RelationshipRail>
                <RelationshipLink label="Upload" value={shortId(job.upload_id)} href={sectionHref("uploads", "upload", job.upload_id)} />
                <RelationshipLink label="Events" value={events.length} />
              </RelationshipRail>
              <EventList events={events} empty="No events recorded for this job." />
            </div>
          )}
        </DetailPanel>
      }
    />
  );
}

function SourcesSection({ sources, uploads, sourceChunks, selectedSource }: { sources: SourceRecord[]; uploads: UploadRecord[]; sourceChunks: ChunkRecord[]; selectedSource: SourceRecord | null }) {
  const sourceUpload = selectedSource ? uploads.find((upload) => upload.id === selectedSource.upload_id) ?? null : null;
  const previewChunks = selectedSource ? sourceDetailPreviewChunks(sourceChunks) : [];

  return (
    <RecordSplit
      list={
        <RecordList title="Sources" count={sources.length} empty="No indexed sources yet.">
          {sources.map((source) => {
            const upload = uploads.find((uploadRecord) => uploadRecord.id === source.upload_id) ?? null;
            const displayType = sourceDisplayType(source, upload);

            return (
              <DenseRow
                key={source.id}
                href={sectionHref("sources", "source", source.id)}
                active={selectedSource?.id === source.id}
                eyebrow={displayType}
                title={source.title ?? source.original_filename}
                detail={`${source.chunk_count} chunks · ${source.indexed_chunk_count} indexed`}
                meta={[`type ${displayType}`, `source ${shortId(source.id)}`, `upload ${shortId(source.upload_id)}`, formatDate(source.created_at)]}
              />
            );
          })}
        </RecordList>
      }
      detail={
        <DetailPanel title="Source detail" empty="Select a source to inspect indexing metadata." item={selectedSource}>
          {(source) => (
            <div className="space-y-4">
              <SourceMeta source={source} upload={sourceUpload} />
              <RelationshipRail>
                <RelationshipLink label="Upload" value={sourceUpload ? sourceUpload.original_filename : shortId(source.upload_id)} href={sectionHref("uploads", "upload", source.upload_id)} />
                <RelationshipLink label="Loaded chunks" value={previewChunks.length} href={previewChunks[0] ? sectionHref("chunks", "chunk", previewChunks[0].id) : undefined} />
              </RelationshipRail>
              <PreviewStack chunks={previewChunks} empty="No loaded chunk previews match this source yet." />
            </div>
          )}
        </DetailPanel>
      }
    />
  );
}

function RetrievalSection({ retrievalRuns, selectedRetrieval }: { retrievalRuns: RetrievalRun[]; selectedRetrieval: RetrievalRun | null }) {
  return (
    <RecordSplit
      list={
        <RecordList title="Retrieval runs" count={retrievalRuns.length} empty="No retrieval runs yet.">
          {retrievalRuns.map((run) => (
            <DenseRow
              key={run.id}
              href={sectionHref("retrieval", "retrieval", run.id)}
              active={selectedRetrieval?.id === run.id}
              eyebrow={run.status}
              title={run.query || "Untitled query"}
              detail={`session ${shortId(run.chat_session_id)} · user message ${shortId(run.user_message_id)}`}
              meta={[`run ${shortId(run.id)}`, formatDate(run.created_at), run.assistant_message_id ? `assistant ${shortId(run.assistant_message_id)}` : "no assistant message"]}
            />
          ))}
        </RecordList>
      }
      detail={
        <DetailPanel title="Retrieval detail" empty="Select a retrieval run to inspect query and message relationships." item={selectedRetrieval}>
          {(run) => <RetrievalMeta run={run} />}
        </DetailPanel>
      }
    />
  );
}

function ChunksSection({ chunks, sources, selectedChunk }: { chunks: ChunkRecord[]; sources: SourceRecord[]; selectedChunk: ChunkRecord | null }) {
  const chunkSource = selectedChunk ? sources.find((source) => source.upload_id === selectedChunk.upload_id) ?? null : null;

  return (
    <RecordSplit
      list={
        <RecordList title="Chunks" count={chunks.length} empty="Chunks appear after ingestion reaches chunking.">
          {chunks.map((chunk) => (
            <DenseRow
              key={chunk.id}
              href={sectionHref("chunks", "chunk", chunk.id)}
              active={selectedChunk?.id === chunk.id}
              eyebrow={`chunk ${chunk.chunk_index}`}
              title={previewText(chunk.content, 96)}
              detail={`upload ${shortId(chunk.upload_id)} · job ${shortId(chunk.ingestion_job_id)}`}
              meta={[`id ${shortId(chunk.id)}`, formatDate(chunk.created_at)]}
            />
          ))}
        </RecordList>
      }
      detail={
        <DetailPanel title="Chunk detail" empty="Select a chunk to inspect content and relationships." item={selectedChunk}>
          {(chunk) => (
            <div className="space-y-4">
              <MetadataGrid>
                <MetaItem label="Chunk id" value={chunk.id} mono />
                <MetaItem label="Chunk index" value={String(chunk.chunk_index)} />
                <MetaItem label="Upload id" value={chunk.upload_id} mono />
                <MetaItem label="Job id" value={chunk.ingestion_job_id} mono />
                <MetaItem label="Created" value={formatDate(chunk.created_at)} />
                <MetaItem label="Metadata keys" value={metadataKeys(chunk.metadata)} />
              </MetadataGrid>
              <RelationshipRail>
                <RelationshipLink label="Source" value={chunkSource ? chunkSource.original_filename : "not in loaded sources"} href={chunkSource ? sectionHref("sources", "source", chunkSource.id) : undefined} />
                <RelationshipLink label="Upload" value={shortId(chunk.upload_id)} href={sectionHref("uploads", "upload", chunk.upload_id)} />
                <RelationshipLink label="Job" value={shortId(chunk.ingestion_job_id)} href={sectionHref("jobs", "job", chunk.ingestion_job_id)} />
              </RelationshipRail>
              <article className="border border-border bg-cream p-3">
                <p className="micro-label text-muted">Content preview</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{previewText(chunk.content, 1200)}</p>
              </article>
            </div>
          )}
        </DetailPanel>
      }
    />
  );
}

function TabLink({ tab, active }: { tab: TabDefinition; active: boolean }) {
  return (
    <Link
      className={cn(
        "inline-flex shrink-0 items-center gap-2 border border-transparent px-3 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-muted transition-colors",
        active ? "border-border bg-card text-foreground shadow-inset" : "hover:border-border hover:bg-card-muted hover:text-foreground",
      )}
      to={sectionHref(tab.id)}
    >
      {tab.label}
      <span className="font-mono text-[0.65rem] opacity-70">{tab.count}</span>
    </Link>
  );
}

function RecordSplit({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return <div className="records-split">{list}{detail}</div>;
}

function RecordList({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <Card className="records-panel">
      <div className="records-panel-header">
        <PanelHeader title={title} count={count} />
      </div>
      <div className="records-list">{count > 0 ? children : <p className="records-empty">{empty}</p>}</div>
    </Card>
  );
}

function DenseRow({ href, active, eyebrow, title, detail, meta }: { href: string; active: boolean; eyebrow: string; title: string; detail: string; meta: string[] }) {
  return (
    <Link
      className={cn(
        "records-row",
        active && "records-row-active",
      )}
      to={href}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-clay-dark">{eyebrow}</p>
          <p className="mt-1 break-words text-sm font-semibold leading-5 text-foreground">{title}</p>
        </div>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">open</span>
      </div>
      <p className="break-words text-xs leading-5 text-muted">{detail}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2">
        {meta.map((item) => (
          <span key={item} className="break-anywhere font-mono text-[0.65rem] text-muted">{item}</span>
        ))}
      </div>
    </Link>
  );
}

function DetailPanel<T>({ title, empty, item, children }: { title: string; empty: string; item: T | null; children: (item: T) => ReactNode }) {
  return (
    <Card className="records-detail">
      <PanelHeader title={title} count={item ? 1 : 0} />
      <div className="mt-4">{item ? children(item) : <p className="text-sm leading-6 text-muted">{empty}</p>}</div>
    </Card>
  );
}

function SummaryCard({ title, empty, href, children }: { title: string; empty: string; href?: string; children: ReactNode }) {
  const content = (
    <Card className="records-summary-card">
      <PanelHeader title={title} count={children ? 1 : 0} />
      <div className="mt-4">{children || <p className="text-sm text-muted">{empty}</p>}</div>
    </Card>
  );

  return href ? <Link to={href} className="block h-full transition-opacity hover:opacity-90">{content}</Link> : content;
}

function PanelHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="micro-label text-muted">{title}</p>
      <span className="border border-border bg-cream px-2 py-1 font-mono text-[0.65rem] text-muted">{count}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-cream p-2">
      <p className="font-serif text-2xl tracking-[-0.05em] text-foreground">{value}</p>
      <p className="micro-label text-muted">{label}</p>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-cream p-3">
      <p className="font-mono text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function MetadataGrid({ children }: { children: ReactNode }) {
  return <dl className="records-metadata-grid">{children}</dl>;
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="records-meta-item">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-1 break-anywhere text-foreground", mono && "font-mono text-xs")}>{value || "—"}</dd>
    </div>
  );
}

function RelationshipRail({ children }: { children: ReactNode }) {
  return <div className="records-relationship-rail">{children}</div>;
}

function RelationshipLink({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = (
    <div className={cn("border border-border bg-cream p-3 text-sm", href && "transition-colors hover:border-clay hover:bg-card-muted")}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-anywhere font-mono text-xs text-foreground">{value}</p>
    </div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

function JobMeta({ job, compact = false }: { job: IngestionJob; compact?: boolean }) {
  return (
    <MetadataGrid>
      <MetaItem label="Status" value={job.status} mono />
      <MetaItem label="Job id" value={job.id} mono />
      <MetaItem label="Upload id" value={job.upload_id} mono />
      <MetaItem label="Created" value={formatDate(job.created_at)} />
      <MetaItem label="Updated" value={formatDate(job.updated_at)} />
      <MetaItem label="Metadata keys" value={metadataKeys(job.metadata)} />
      {!compact ? <MetaItem label="Error summary" value={job.error_summary ?? "none"} /> : null}
    </MetadataGrid>
  );
}

function SourceMeta({ source, upload }: { source: SourceRecord; upload?: UploadRecord | null }) {
  return (
    <MetadataGrid>
      <MetaItem label="Title" value={source.title ?? source.original_filename} />
      <MetaItem label="Type" value={sourceDisplayType(source, upload ?? null)} />
      <MetaItem label="Source id" value={source.id} mono />
      <MetaItem label="Upload id" value={source.upload_id} mono />
      <MetaItem label="Source key" value={source.extension} />
      <MetaItem label="Chunks" value={`${source.chunk_count} total`} />
      <MetaItem label="Indexed" value={`${source.indexed_chunk_count} indexed`} />
      <MetaItem label="Created" value={formatDate(source.created_at)} />
      <MetaItem label="SHA-256" value={source.sha256} mono />
    </MetadataGrid>
  );
}

function RetrievalMeta({ run }: { run: RetrievalRun }) {
  return (
    <div className="space-y-4">
      <MetadataGrid>
        <MetaItem label="Status" value={run.status} mono />
        <MetaItem label="Run id" value={run.id} mono />
        <MetaItem label="Chat session" value={run.chat_session_id} mono />
        <MetaItem label="User message" value={run.user_message_id} mono />
        <MetaItem label="Assistant message" value={run.assistant_message_id ?? "none"} mono />
        <MetaItem label="Created" value={formatDate(run.created_at)} />
        <MetaItem label="Metadata keys" value={metadataKeys(run.metadata)} />
      </MetadataGrid>
      <article className="border border-border bg-cream p-3">
        <p className="micro-label text-muted">Query</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{run.query || "No query text recorded."}</p>
      </article>
    </div>
  );
}

function EventList({ events, empty }: { events: IngestionEvent[]; empty: string }) {
  return (
    <div className="mt-3 grid gap-2">
      {events.length ? events.map((event) => <EventRow key={event.id} event={event} />) : <p className="text-sm leading-6 text-muted">{empty}</p>}
    </div>
  );
}

function EventRow({ event }: { event: IngestionEvent }) {
  return (
    <article className="border border-border bg-cream p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-clay-dark">{event.event_type}</p>
        <time className="font-mono text-[0.65rem] text-muted" dateTime={event.created_at}>{formatDate(event.created_at)}</time>
      </div>
      <p className="mt-2 text-sm leading-6 text-foreground">{event.message ?? "No message"}</p>
      <p className="mt-2 break-anywhere font-mono text-[0.65rem] text-muted">event {event.id} · upload {shortId(event.upload_id)}</p>
    </article>
  );
}

function PreviewStack({ chunks, empty }: { chunks: ChunkRecord[]; empty: string }) {
  return (
    <div className="grid gap-2">
      {chunks.length ? chunks.slice(0, 3).map((chunk) => (
        <Link key={chunk.id} to={sectionHref("chunks", "chunk", chunk.id)} className="border border-border bg-cream p-3 transition-colors hover:border-clay hover:bg-card-muted">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-clay-dark">chunk {chunk.chunk_index}</p>
          <p className="mt-2 text-sm leading-6 text-foreground">{previewText(chunk.content, 180)}</p>
        </Link>
      )) : <p className="text-sm text-muted">{empty}</p>}
    </div>
  );
}

function getSection(value: string | null): RecordsSection {
  return value && isRecordsSection(value) ? value : "overview";
}

function isRecordsSection(value: string): value is RecordsSection {
  return recordsSections.includes(value as RecordsSection);
}

function findById<T extends { id: string }>(records: T[], id: string | null) {
  return id ? records.find((record) => record.id === id) ?? null : null;
}

function findSource(records: SourceRecord[], id: string | null) {
  if (!id) {
    return null;
  }
  return records.find((record) => record.id === id || record.upload_id === id) ?? null;
}

function sectionHref(section: RecordsSection, key?: string, value?: string) {
  const params = new URLSearchParams({ section });
  if (key && value) {
    params.set(key, value);
  }
  return `/records?${params.toString()}`;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function previewText(value: string, maxLength = 520) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

function metadataKeys(metadata: Record<string, unknown>) {
  const keys = Object.keys(metadata);
  return keys.length ? keys.join(", ") : "none";
}

export function sourceTypeLabel(sourceType: string) {
  const normalizedSourceType = sourceType.trim().toLowerCase();

  if (normalizedSourceType === "archived_webpage") {
    return "Archived webpage";
  }
  if (normalizedSourceType === "ddb_saved_html") {
    return "DDB saved HTML";
  }
  if (normalizedSourceType === "html" || normalizedSourceType === "htm") {
    return "Plain HTML";
  }
  if (normalizedSourceType === "md" || normalizedSourceType === "markdown") {
    return "Markdown";
  }
  if (normalizedSourceType === "txt") {
    return "Plain text";
  }
  if (normalizedSourceType === "epub") {
    return "EPUB";
  }

  return sourceType || "Source";
}

export function sourceDisplayType(source: Pick<SourceRecord, "extension">, upload?: Pick<UploadRecord, "content_type" | "extension" | "original_filename"> | null) {
  if (uploadIsZipArchive(upload)) {
    return "Archived webpage";
  }

  return sourceTypeLabel(source.extension);
}

export function sourceDetailPreviewChunks(sourceChunks: ChunkRecord[]) {
  return sourceChunks;
}

function uploadIsZipArchive(upload: Pick<UploadRecord, "content_type" | "extension" | "original_filename"> | null | undefined) {
  if (!upload) {
    return false;
  }

  return uploadFileType(upload.extension) === "zip"
    || uploadFileType(upload.original_filename) === "zip"
    || upload.content_type.toLowerCase().includes("zip");
}

function uploadFileType(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  const extensionStart = normalizedValue.lastIndexOf(".");

  return extensionStart > -1 ? normalizedValue.slice(extensionStart + 1) : normalizedValue.replace(/^\./, "");
}

function sumChunks(sources: SourceRecord[]) {
  return sources.reduce((total, source) => total + source.chunk_count, 0);
}
