import {
  SRD_ATTRIBUTION,
  SRD_CHANGE_NOTICE,
  SRD_DATA_SOURCE,
} from "@the-stacks/srd/attribution";

/**
 * About: the SRD 5.2.1 attribution (CC-BY-4.0), verbatim, plus the change
 * notice and the data source. A route, not a modal. Imports the attribution
 * subpath only, so no SRD data enters the client bundle.
 */
export default function About() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold">About</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        the-stacks is 5E compatible.
      </p>
      <section aria-labelledby="attribution-heading" className="mb-4">
        <h2 id="attribution-heading" className="mb-1 text-sm font-semibold">
          Attribution
        </h2>
        <blockquote className="max-w-prose border-l-2 border-border pl-3 text-sm">
          {SRD_ATTRIBUTION}
        </blockquote>
      </section>
      <section aria-labelledby="changes-heading" className="mb-4">
        <h2 id="changes-heading" className="mb-1 text-sm font-semibold">
          Changes
        </h2>
        <p className="max-w-prose text-sm">{SRD_CHANGE_NOTICE}</p>
      </section>
      {SRD_DATA_SOURCE && (
        <section aria-labelledby="source-heading">
          <h2 id="source-heading" className="mb-1 text-sm font-semibold">
            Data source
          </h2>
          <p className="max-w-prose text-sm">
            Records are converted from {SRD_DATA_SOURCE.name} (
            <a className="underline" href={SRD_DATA_SOURCE.url}>
              {SRD_DATA_SOURCE.url}
            </a>
            ), commit {SRD_DATA_SOURCE.commit}, licensed{" "}
            {SRD_DATA_SOURCE.license}. The converter also reads the SRD 5.2.1
            PDF to repair and check every record.
          </p>
        </section>
      )}
    </div>
  );
}
