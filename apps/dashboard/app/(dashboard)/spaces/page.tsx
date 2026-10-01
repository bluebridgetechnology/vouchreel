import { requireSession } from "@/lib/auth/session";
import { getSpacesWithCounts } from "@/lib/spaces/queries";
import { SpacesView } from "@/components/spaces/spaces-view";

export default async function SpacesPage() {
  const session = await requireSession();
  const spaces = await getSpacesWithCounts(session.user.id);
  return <SpacesView initialSpaces={spaces} />;
}
