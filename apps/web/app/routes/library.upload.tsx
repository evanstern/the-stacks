/**
 * /library/upload — the minimal operator upload surface (008 FR-027, US1).
 * A plain multipart HTML form posting back to this route's action, which
 * relays it through lib/api.server.ts (the one legal path to the API,
 * 007 FR-019). Deliberately bare: the full Records surface is a later spec;
 * this page exists so the submit → ticket journey needs no curl.
 *
 * Success answers with the claim ticket inline (and a link to the ticket
 * page, which US2 adds); typed refusals (415 unsupported/oversized, FR-002)
 * render as messages, not error pages — an honest "no" is a normal outcome
 * of this form.
 */
import { Form, Link } from "react-router";

import { Button } from "~/components/ui/button";
import { uploadToLibrary } from "~/lib/api.server";
import type { Route } from "./+types/library.upload";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const result = await uploadToLibrary(request, formData);
  return { result };
}

export default function LibraryUpload({ actionData }: Route.ComponentProps) {
  const result = actionData?.result;

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Add to the library</h1>
      <p className="text-sm text-muted-foreground">
        Upload your own lawfully owned material: a saved D&D Beyond page (HTML), a ZIP export,
        Markdown, or plain text. Processing is asynchronous — you get a claim ticket immediately.
      </p>

      <Form method="post" encType="multipart/form-data" className="space-y-4">
        <input
          type="file"
          name="file"
          aria-label="File to upload"
          required
          className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-secondary file:px-4 file:py-2"
        />
        <Button type="submit">Upload</Button>
      </Form>

      {result && "ticket" in result && (
        <div className="rounded border p-4 text-sm" data-testid="upload-result">
          {result.duplicate ? (
            <p>
              Already in the library — identical content was uploaded before (dedupe is by
              content, not filename). Ticket:{" "}
            </p>
          ) : (
            <p>Accepted. Processing has been queued. Ticket: </p>
          )}
          <Link
            className="font-mono underline"
            to={`/library/uploads/${result.ticket.kind}/${result.ticket.id}`}
          >
            {result.ticket.kind}/{result.ticket.id}
          </Link>
        </div>
      )}

      {result && "message" in result && (
        <div className="rounded border border-destructive p-4 text-sm" data-testid="upload-error">
          <p>{result.message}</p>
        </div>
      )}
    </main>
  );
}
