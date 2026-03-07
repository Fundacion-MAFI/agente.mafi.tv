"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "@/components/toast";

type IngestProgress = { current: number; total: number };

function parseProgress(output: string | null): IngestProgress | null {
  if (!output) return null;
  const matches = [...output.matchAll(/📊\s*(\d+)\/(\d+)/g)];
  const last = matches.at(-1);
  if (!last) return null;
  const current = Number.parseInt(last[1], 10);
  const total = Number.parseInt(last[2], 10);
  return Number.isFinite(current) && Number.isFinite(total)
    ? { current, total }
    : null;
}

type AdminIngestContextValue = {
  running: boolean;
  output: string | null;
  progress: IngestProgress | null;
  runIngest: () => Promise<void>;
  registerOnComplete: (fn: () => void | Promise<void>) => void;
  unregisterOnComplete: () => void;
};

const AdminIngestContext = createContext<AdminIngestContextValue | null>(null);

export function AdminIngestProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const onCompleteRef = useRef<(() => void | Promise<void>) | null>(null);

  const registerOnComplete = useCallback((fn: () => void | Promise<void>) => {
    onCompleteRef.current = fn;
  }, []);

  const unregisterOnComplete = useCallback(() => {
    onCompleteRef.current = null;
  }, []);

  const runIngest = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setOutput(null);

    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.body) {
        const data = await res.json().catch(() => ({}));
        const errMsg = (data.error as string) ?? "No response body";
        setOutput(errMsg);
        toast({ type: "error", description: errMsg });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;

          let data: {
            type: string;
            line?: string;
            ok?: boolean;
            error?: string;
          };
          try {
            data = JSON.parse(line) as typeof data;
          } catch {
            continue;
          }

          if (data.type === "log" && typeof data.line === "string") {
            setOutput((prev) => (prev ?? "") + data.line + "\n");
          } else if (data.type === "done") {
            if (data.ok) {
              toast({ type: "success", description: "Embedding completed" });
              await onCompleteRef.current?.();
            } else {
              toast({
                type: "error",
                description: (data.error as string) ?? "Embedding failed",
              });
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim()) as {
            type: string;
            line?: string;
            ok?: boolean;
            error?: string;
          };
          if (data.type === "log" && typeof data.line === "string") {
            setOutput((prev) => (prev ?? "") + data.line + "\n");
          } else if (data.type === "done" && !data.ok) {
            toast({
              type: "error",
              description: (data.error as string) ?? "Embedding failed",
            });
          }
        } catch {
          // ignore parse errors for trailing buffer
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Request failed";
      setOutput(errMsg);
      toast({ type: "error", description: errMsg });
    } finally {
      setRunning(false);
      await onCompleteRef.current?.();
    }
  }, [running]);

  const progress = useMemo(() => parseProgress(output), [output]);

  const value = useMemo<AdminIngestContextValue>(
    () => ({
      running,
      output,
      progress,
      runIngest,
      registerOnComplete,
      unregisterOnComplete,
    }),
    [
      running,
      output,
      progress,
      runIngest,
      registerOnComplete,
      unregisterOnComplete,
    ]
  );

  return (
    <AdminIngestContext.Provider value={value}>
      {children}
    </AdminIngestContext.Provider>
  );
}

export function useAdminIngest() {
  const ctx = useContext(AdminIngestContext);
  if (!ctx) {
    return null;
  }
  return ctx;
}
