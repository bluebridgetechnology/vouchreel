export default function Loading() {
  return (
    <div
      className="flex min-h-[70vh] items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading</span>
      <div
        className="h-8 w-8 animate-spin rounded-pill border-2 border-border border-t-brand"
        aria-hidden="true"
      />
    </div>
  );
}
