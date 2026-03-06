"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAdminIngest } from "../admin-ingest-context";

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
  models: {
    modelId: string;
    embeddingCount: number;
    isReady: boolean;
    chunkSize: number | null;
    chunkOverlap: number | null;
  }[];
};

export function IngestTrigger() {
  const ingest = useAdminIngest();
  const [status, setStatus] = useState<EmbeddingsStatusAll | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purgeModelId, setPurgeModelId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  const running = ingest?.running ?? false;
  const output = ingest?.output ?? null;

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

  useEffect(() => {
    if (ingest) {
      ingest.registerOnComplete(fetchStatus);
      return () => ingest.unregisterOnComplete();
    }
  }, [ingest, fetchStatus]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handlePurge = useCallback(
    async (modelId: string) => {
      if (purging) return;
      setPurgeModelId(null);
      setPurging(true);
      try {
        const res = await fetch("/api/admin/embeddings/purge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId }),
        });
        const data = await res.json();
        if (res.ok) {
          toast({
            type: "success",
            description: `Purged ${data.deleted} embeddings`,
          });
          await fetchStatus();
        } else {
          toast({ type: "error", description: data.error ?? "Purge failed" });
        }
      } catch (err) {
        toast({ type: "error", description: "Purge failed" });
      } finally {
        setPurging(false);
      }
    },
    [purging, fetchStatus]
  );

  const handleSelectModel = useCallback(
    async (modelId: string) => {
      try {
        const res = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ "embedding.model": modelId }),
        });
        if (res.ok) {
          toast({ type: "success", description: "Model selected" });
          await fetchStatus();
        } else {
          toast({ type: "error", description: "Failed to select model" });
        }
      } catch (err) {
        toast({ type: "error", description: "Failed to select model" });
      }
    },
    [fetchStatus]
  );

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
                <th className="px-4 py-2 font-medium">Chunk</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {status.models.map((m) => (
                <tr
                  className={`border-b last:border-b-0 ${
                    m.modelId === status.activeModel ? "bg-muted/30" : ""
                  }`}
                  key={m.modelId}
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
                      className={`inline-flex rounded px-2 py-0.5 font-medium text-xs ${
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
                  <td className="px-4 py-2 text-muted-foreground">
                    {m.chunkSize != null && m.chunkOverlap != null ? (
                      <span>
                        {m.chunkSize} / {m.chunkOverlap}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={purging || m.embeddingCount === 0}
                        onClick={() => setPurgeModelId(m.modelId)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Purge
                      </Button>
                      <Button
                        disabled={m.modelId === status.activeModel}
                        onClick={() => handleSelectModel(m.modelId)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Select
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        onOpenChange={(open) => !open && setPurgeModelId(null)}
        open={purgeModelId != null}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Purge embeddings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all embeddings for this model. You
              will need to run ingestion again to recreate them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={purging}
              onClick={() =>
                purgeModelId ? handlePurge(purgeModelId) : undefined
              }
              type="button"
              variant="destructive"
            >
              {purging ? "Purging…" : "Purge"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Ingestion uses the model selected in{" "}
          <a className="underline" href="/admin/settings">
            Settings
          </a>
          . Run ingestion to populate embeddings for that model.
        </p>
        <Button
          disabled={running}
          onClick={() => {
            setConfirmOpen(true);
          }}
          type="button"
        >
          {running ? "Running…" : "Run ingestion"}
        </Button>
      </div>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Run ingestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This may take several minutes and will update embeddings for the
              selected model (see Settings).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={running}
              onClick={() => {
                setConfirmOpen(false);
                void ingest?.runIngest();
              }}
              type="button"
            >
              Run ingestion
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(running || output) && (
        <pre
          className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-input bg-muted p-4 text-muted-foreground text-xs"
          ref={outputRef}
        >
          {output || (running ? "Starting…" : "")}
        </pre>
      )}
    </div>
  );
}
