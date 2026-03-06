"use client";

import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const IMPORT_WARNING =
  "Bulk import does not check for duplicates. Rows with the same slug will overwrite existing shots.";

export function ShotsBulkActions() {
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = (format: "csv" | "xlsx") => {
    window.open(`/api/admin/shots/export?format=${format}`, "_blank");
  };

  const handleTemplateDownload = (format: "csv" | "xlsx") => {
    window.open(`/api/admin/shots/template?format=${format}`, "_blank");
  };

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      toast({ type: "error", description: "Please select a file." });
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "format",
        file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv"
      );

      const res = await fetch("/api/admin/shots/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Import failed");
      }

      const { imported, failed, total } = data;
      if (failed > 0) {
        toast({
          type: "warning",
          description: `Imported ${imported} of ${total} shots. ${failed} failed.`,
        });
      } else {
        toast({
          type: "success",
          description: `Successfully imported ${imported} shots.`,
        });
      }
      setImportOpen(false);
      form.reset();
      window.location.reload();
    } catch (err) {
      toast({
        type: "error",
        description: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Sheet onOpenChange={setImportOpen} open={importOpen}>
        <SheetTrigger asChild>
          <Button size="sm" type="button" variant="outline">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import
          </Button>
        </SheetTrigger>
        <SheetContent className="sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>Bulk import shots</SheetTitle>
            <SheetDescription>
              Upload a CSV or XLSX file. Each row must have{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">slug</code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                title
              </code>
              .
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <p className="text-sm">{IMPORT_WARNING}</p>
              <p className="mt-2 text-sm">
                To update individual shots, open any shot from the list and use
                the &quot;Update from Markdown&quot; option in the editor.
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleImport}>
              <div>
                <label
                  className="mb-1.5 block font-medium text-sm"
                  htmlFor="bulk-import-file"
                >
                  File
                </label>
                <input
                  accept=".csv,.xlsx"
                  className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:font-medium file:text-primary-foreground file:text-sm file:hover:bg-primary/90"
                  id="bulk-import-file"
                  name="file"
                  onChange={() => {}}
                  ref={fileInputRef}
                  required
                  type="file"
                />
              </div>
              <Button disabled={importing} type="submit">
                {importing ? "Importing…" : "Import"}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex gap-1">
        <Button
          onClick={() => handleExport("csv")}
          size="sm"
          type="button"
          variant="outline"
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
        <Button
          onClick={() => handleExport("xlsx")}
          size="sm"
          type="button"
          variant="outline"
        >
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
          Export XLSX
        </Button>
      </div>

      <div className="flex gap-1">
        <Button
          onClick={() => handleTemplateDownload("csv")}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Template CSV
        </Button>
        <Button
          onClick={() => handleTemplateDownload("xlsx")}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Template XLSX
        </Button>
      </div>
    </div>
  );
}
