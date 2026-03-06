import Link from "next/link";
import { ShotsBulkActions } from "./shots-bulk-actions";
import { ShotsList } from "./shots-list";

export default function AdminShotsPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl">MAFI Shots</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ShotsBulkActions />
          <Link
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
            href="/admin/shots/new"
          >
            Add shot
          </Link>
        </div>
      </div>
      <ShotsList />
    </div>
  );
}
