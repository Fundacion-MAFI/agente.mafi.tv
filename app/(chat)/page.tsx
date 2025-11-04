import { redirect } from "next/navigation";
import { MafiChat } from "@/components/mafi-chat";
import { auth } from "../(auth)/auth";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-8">
      <MafiChat />
    </div>
  );
}
