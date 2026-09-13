import Link from "next/link";

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
        <p className="text-xs text-muted-foreground">
          Track impressions, video plays, click-throughs, and conversions.
        </p>
      </div>

      <div className="rounded-xl border border-dashed p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-semibold">Analytics Coming in Sprint 6</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          In Sprint 6, full play tracking, impression metrics, and conversion funnels will be unlocked.
        </p>
        <Link
          href={`/spaces/${id}/testimonials`}
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Return to Testimonials
        </Link>
      </div>
    </div>
  );
}
