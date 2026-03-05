"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast";

export function IngestTrigger() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const handleIngest = async () => {
    if (running) return;
    if (
      !confirm(
        "Run ingestion? This may take several minutes and will update embeddings for changed shots."
      )
    ) {
      return;
    }

    setRunning(true);
    setOutput(null);

    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(data.output ?? "Done.");
        toast({ type: "success", description: "Ingestion completed" });
      } else {
        setOutput(
          [data.output, data.stderr].filter(Boolean).join("\n\n") ||
            data.error ||
            "Unknown error"
        );
        toast({ type: "error", description: data.error ?? "Ingestion failed" });
      }
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Request failed");
      toast({ type: "error", description: "Ingestion failed" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        disabled={running}
        onClick={handleIngest}
        type="button"
      >
        {running ? "Running…" : "Run ingestion"}
      </Button>

      {output && (
        <pre className="max-h-96 overflow-auto rounded-md border border-input bg-muted p-4 text-muted-foreground text-xs whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}
