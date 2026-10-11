import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { WidgetsView } from "@/components/widget/widgets-view";
import { ensurePrimaryWidget, getWidgetQuota, listWidgets, widgetSummary } from "@/lib/widgets/service";
import { getWidgetStats } from "@/lib/widgets/stats";

export const dynamic = "force-dynamic";

interface WidgetsPageProps {
  params: Promise<{ id: string }>;
}

/** The space's widgets. (The space layout has already checked that the signed-in user owns the space.) */
export default async function SpaceWidgetsPage({ params }: WidgetsPageProps) {
  const { id } = await params;
  await ensurePrimaryWidget(id);
  const [widgets, quota, [space], stats] = await Promise.all([listWidgets(id), getWidgetQuota(id), db.select({ embedKey: spaces.embedKey }).from(spaces).where(eq(spaces.id, id)), getWidgetStats(id)]);

  return (
    <WidgetsView
      spaceId={id}
      embedKey={space?.embedKey ?? ""}
      stats={Object.fromEntries(stats)}
      widgets={widgets.map((w) => ({ ...widgetSummary(w), publishedAt: w.publishedAt?.toISOString() ?? null, createdAt: w.createdAt.toISOString() }))}
      quota={quota ? { current: quota.current, limit: Number.isFinite(quota.limit) ? quota.limit : null, allowed: quota.allowed } : { current: widgets.length, limit: null, allowed: true }}
    />
  );
}
