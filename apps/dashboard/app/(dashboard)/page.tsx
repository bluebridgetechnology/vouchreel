export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Spaces</h1>
        <p className="text-muted-foreground">
          Manage your testimonial spaces and widgets
        </p>
      </div>

      {/* Empty state — will be replaced by actual space list in Sprint 3 */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <svg
            className="h-6 w-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium">No spaces yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first space to start collecting and displaying video
          testimonials.
        </p>
        <button className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Create a space
        </button>
      </div>
    </div>
  );
}
