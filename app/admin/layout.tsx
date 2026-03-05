import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/admin";

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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center gap-6 px-4">
          <Link
            className="font-semibold text-foreground hover:underline"
            href="/admin"
          >
            Admin
          </Link>
          <nav className="flex gap-4">
            <Link
              className="text-muted-foreground text-sm hover:text-foreground"
              href="/admin/shots"
            >
              Shots
            </Link>
            <Link
              className="text-muted-foreground text-sm hover:text-foreground"
              href="/"
            >
              ← Back to app
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
