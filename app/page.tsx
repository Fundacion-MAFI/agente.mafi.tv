import { LandingPage } from "@/components/landing-page";
import { auth } from "./(auth)/auth";

export default async function Page() {
  const session = await auth();

  return <LandingPage isAuthenticated={!!session} />;
}
