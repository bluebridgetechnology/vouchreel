import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getHomeData } from "@/lib/home/queries";
import { HomeView } from "@/components/home/home-view";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireSession();
  const range = (await searchParams).range === "30" ? 30 : 7;

  const data = await getHomeData(session.user.id, range);
  // No space yet: the onboarding flow creates the first one
  if (!data) redirect("/onboarding");

  const firstName = (session.user.name || "").trim().split(/\s+/)[0] || "";
  return <HomeView data={data} firstName={firstName} />;
}
