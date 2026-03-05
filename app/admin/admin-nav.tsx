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
import { useAdminDirty } from "./admin-dirty-context";

const NAV_LINKS = [
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/shots", label: "Shots" },
  { href: "/admin/ingest", label: "Ingest" },
  { href: "/", label: "← Back to app" },
] as const;

export function AdminNav() {
  const router = useRouter();
  const dirty = useAdminDirty();
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

  return (
    <>
      <nav className="flex gap-4">
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
