"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";

const MODEL_LABELS: Record<string, string> = {
  "openai/text-embedding-3-small": "OpenAI 3 Small",
  "openai/text-embedding-3-large": "OpenAI 3 Large",
  "mistral/mistral-embed": "Mistral Embed",
  "google/gemini-embedding-001": "Google Gemini",
  "google/text-multilingual-embedding-002": "Google Multilingual 002",
  "google/text-embedding-005": "Google Embedding 005",
  "alibaba/qwen3-embedding-4b": "Alibaba Qwen3 4B",
  "amazon/titan-embed-text-v2": "Amazon Titan v2",
};

type EmbeddingsStatusAll = {
  shotCount: number;
  activeModel: string;
  models: { modelId: string; embeddingCount: number; isReady: boolean }[];
};

export function IngestTrigger() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [status, setStatus] = useState<EmbeddingsStatusAll | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/admin/embeddings-status?all=true");
    if (res.ok) {
      const data = await res.json();
      setStatus(data);
    } else {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleIngest = async () => {
    if (running) return;
    if (
      !confirm(
        "Run ingestion? This may take several minutes and will update embeddings for the selected model (see Settings)."
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
        await fetchStatus();
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
    <div className="space-y-6">
      {status && (
        <div className="rounded-md border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Shots</th>
              </tr>
            </thead>
            <tbody>
              {status.models.map((m) => (
                <tr
                  key={m.modelId}
                  className={`border-b last:border-b-0 ${
                    m.modelId === status.activeModel ? "bg-muted/30" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    <span className="font-medium">
                      {MODEL_LABELS[m.modelId] ?? m.modelId}
                    </span>
                    {m.modelId === status.activeModel && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        (selected)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        m.isReady
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {m.isReady ? "Ready" : "Missing"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {m.embeddingCount} / {status.shotCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Ingestion uses the model selected in{" "}
          <a className="underline" href="/admin/settings">
            Settings
          </a>
          . Run ingestion to populate embeddings for that model.
        </p>
        <Button disabled={running} onClick={handleIngest} type="button">
          {running ? "Running…" : "Run ingestion"}
        </Button>
      </div>

      {output && (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-input bg-muted p-4 text-muted-foreground text-xs">
          {output}
        </pre>
      )}
    </div>
  );
}
