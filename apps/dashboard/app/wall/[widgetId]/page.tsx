import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { normalizeTheme } from "@/lib/validations/widget-config";
import { WIDGET_MODE_COLOURS } from "@/lib/widget-editor/mode-colours";
import { getWallWidget } from "@/lib/widgets/service";

export const dynamic = "force-dynamic";

interface WallPageProps {
  params: Promise<{ widgetId: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(widgetId: string) {
  return UUID.test(widgetId) ? getWallWidget(widgetId) : null;
}

export async function generateMetadata({ params }: WallPageProps): Promise<Metadata> {
  const found = await load((await params).widgetId);
  if (!found) return { title: "Not found", robots: { index: false } };
  const title = `What customers say about ${found.space.name}`;
  return { title, description: `Video testimonials from ${found.space.name}'s customers.`, openGraph: { title } };
}

/**
 * A widget on a page of its own, for owners with no site to put it on (or a link-in-bio). It is the real widget:
 * the same script, asked for the data under the key "wall-{id}", placed in its spot by id. The page itself is only
 * a heading and room; colours follow the widget's own light/dark mode and background.
 */
export default async function WallPage({ params }: WallPageProps) {
  const { widgetId } = await params;
  const found = await load(widgetId);
  if (!found) notFound();

  const theme = normalizeTheme(found.widget.theme);
  const dark = theme.mode === "dark";
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <main style={{ background: theme.background ?? WIDGET_MODE_COLOURS[dark ? "dark" : "light"].background, color: theme.textColor ?? WIDGET_MODE_COLOURS[dark ? "dark" : "light"].text, minHeight: "100vh" }}>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-8 text-center text-2xl font-medium tracking-tight sm:text-3xl">What customers say about {found.space.name}</h1>
        <div data-vouchreel-widget={found.widget.id} />
      </div>
      <script async src={`/widget/wall-${found.widget.id}.js`} data-key={`wall-${found.widget.id}`} nonce={nonce} />
    </main>
  );
}
