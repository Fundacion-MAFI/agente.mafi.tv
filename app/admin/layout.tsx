import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/admin";
import { AdminDirtyProvider } from "./admin-dirty-context";
import { AdminIngestProvider } from "./admin-ingest-context";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    redirect(auth.redirect);
  }

  return (
    <AdminDirtyProvider>
      <AdminIngestProvider>
        <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto flex h-14 items-center gap-6 px-4">
            <AdminNav />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
        </div>
      </AdminIngestProvider>
    </AdminDirtyProvider>
  );
}
