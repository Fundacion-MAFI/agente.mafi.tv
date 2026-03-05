import { IngestTrigger } from "./ingest-trigger";

export default function AdminIngestPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">Ingestion</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Trigger MAFI shots ingestion from <code>data/mafi-shots/</code>.
          Embedding and throttle settings are configured in{" "}
          <a className="underline" href="/admin/settings">
            Settings
          </a>
          .
        </p>
      </div>
      <IngestTrigger />
    </div>
  );
}
