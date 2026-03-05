import Link from "next/link";
import { ShotsList } from "./shots-list";

export default function AdminShotsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">MAFI Shots</h1>
        <Link
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
          href="/admin/shots/new"
        >
          Add shot
        </Link>
      </div>
      <ShotsList />
    </div>
  );
}
