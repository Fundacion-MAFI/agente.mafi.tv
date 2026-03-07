import { IngestTrigger } from "./ingest-trigger";

export default function AdminIngestPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">Embed</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Refresh MAFI shot embeddings from the database. Embedding uses the
          retrieval model selected in{" "}
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
