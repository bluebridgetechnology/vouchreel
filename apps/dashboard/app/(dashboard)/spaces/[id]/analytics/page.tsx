import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SpaceAnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Analytics & Performance
        </h2>
      </div>
      <AnalyticsDashboard spaceId={id} />
    </div>
  );
}
