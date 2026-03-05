import { IngestTrigger } from "./ingest-trigger";

export default function AdminIngestPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">Ingestion</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Trigger MAFI shots ingestion from <code>data/mafi-shots/</code>.
          Ingestion uses the retrieval model selected in{" "}
          <a className="underline" href="/admin/settings">
            Settings
          </a>
          . Chunk and throttle settings are also configured there.
        </p>
      </div>
      <IngestTrigger />
    </div>
  );
}
