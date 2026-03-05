"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminDirty } from "./admin-dirty-context";
import { useAdminIngest } from "./admin-ingest-context";

const NAV_LINKS = [
  { href: "/admin/shots", label: "Shots" },
  { href: "/admin/ingest", label: "Ingest" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/", label: "← Back to app" },
] as const;

export function AdminNav() {
  const router = useRouter();
  const dirty = useAdminDirty();
  const ingest = useAdminIngest();
  const [saving, setSaving] = useState(false);

  const pendingNav = dirty?.pendingNav ?? null;
  const setPendingNav =
    dirty?.setPendingNav ??
    ((_href: string | null) => {
      void _href;
    });

  const navigateTo = useCallback(
    (href: string) => {
      setPendingNav(null);
      router.push(href);
    },
    [router, setPendingNav]
  );

  const handleSaveAndNavigate = useCallback(async () => {
    if (!pendingNav || !dirty?.onSaveRequest) return;
    setSaving(true);
    try {
      await dirty.onSaveRequest();
      dirty.setDirty(false);
      navigateTo(pendingNav);
    } finally {
      setSaving(false);
    }
  }, [pendingNav, dirty, navigateTo]);

  const handleDiscardAndNavigate = useCallback(() => {
    if (!pendingNav || !dirty) return;
    dirty.setDirty(false);
    navigateTo(pendingNav);
  }, [pendingNav, dirty, navigateTo]);

  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      dirty?.requestNavigation(href);
    },
    [dirty]
  );

  const lastLogLine = ingest?.output?.trim().split("\n").at(-1) ?? null;
  const progress = ingest?.progress;

  return (
    <>
      <nav className="flex flex-1 items-center gap-4">
        <Link
          className="font-semibold text-foreground hover:underline"
          href="/admin"
          onClick={(e) => handleLinkClick(e, "/admin")}
        >
          Admin
        </Link>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            className="text-muted-foreground text-sm hover:text-foreground"
            href={href}
            key={href}
            onClick={(e) => handleLinkClick(e, href)}
          >
            {label}
          </Link>
        ))}
        {ingest?.running && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  className="ml-auto flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 text-sm dark:text-amber-400"
                  href="/admin/ingest"
                  onClick={(e) => handleLinkClick(e, "/admin/ingest")}
                >
                  <span
                    aria-hidden
                    className="size-1.5 animate-pulse rounded-full bg-amber-500"
                  />
                  Ingesting{progress ? ` ${progress.current}/${progress.total}` : "…"}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {lastLogLine ? (
                  <p className="max-w-xs truncate font-mono text-xs">
                    {lastLogLine}
                  </p>
                ) : (
                  <p className="text-xs">View progress on Ingest page</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </nav>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingNav(null);
        }}
        open={pendingNav !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={saving || !dirty?.onSaveRequest}
              onClick={handleDiscardAndNavigate}
              type="button"
              variant="outline"
            >
              Discard
            </Button>
            <Button
              disabled={saving}
              onClick={handleSaveAndNavigate}
              type="button"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
