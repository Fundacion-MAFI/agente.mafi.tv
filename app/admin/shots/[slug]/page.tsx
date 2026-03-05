import { notFound } from "next/navigation";
import { getShotBySlug } from "@/lib/db/admin-shots";
import { ShotEditForm } from "./shot-edit-form";

export default async function AdminShotEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "new") {
    return (
      <div>
        <h1 className="mb-6 font-semibold text-2xl">New shot</h1>
        <ShotEditForm initialData={null} slug={null} />
      </div>
    );
  }

  const shot = await getShotBySlug(slug);
  if (!shot) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 font-semibold text-2xl">Edit: {shot.title}</h1>
      <ShotEditForm initialData={shot} slug={shot.slug} />
    </div>
  );
}
