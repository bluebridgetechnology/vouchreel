"use client";

import { useState } from "react";

interface EmbedSnippetProps {
  embedKey: string;
}

interface PlatformGuide {
  id: string;
  name: string;
  instructions: string[];
}

const PLATFORMS: PlatformGuide[] = [
  {
    id: "html",
    name: "Standard HTML",
    instructions: [
      "Open your website's HTML template or root layout.",
      "Paste the script snippet just before the closing </body> tag or inside the <head> tag.",
      "Save and publish your changes to see the widget live on your site.",
    ],
  },
  {
    id: "wordpress",
    name: "WordPress",
    instructions: [
      "Log in to your WordPress Admin dashboard.",
      "Navigate to Plugins → Add New and install 'WPCode' (or any header/footer injection plugin).",
      "Go to Code Snippets → Header & Footer, and paste the code into the 'Footer' box.",
      "Click 'Save Changes'.",
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    instructions: [
      "In Shopify Admin, go to Online Store → Themes.",
      "Click the '...' button next to your active theme and choose 'Edit code'.",
      "Under Layout, click theme.liquid.",
      "Scroll down to the bottom and paste the script snippet right before </body>.",
      "Click 'Save' in the top right corner.",
    ],
  },
  {
    id: "webflow",
    name: "Webflow",
    instructions: [
      "Open your project in Webflow and open Project Settings.",
      "Click on the 'Custom Code' tab in the left sidebar.",
      "Scroll down to the 'Footer Code' area and paste the embed script.",
      "Save changes and republish your site.",
    ],
  },
  {
    id: "nextjs",
    name: "Next.js / React",
    instructions: [
      "Open your root layout (app/layout.tsx or pages/_app.tsx).",
      "Import the Script component: import Script from 'next/script';",
      "Add <Script async src=\"...\" strategy=\"afterInteractive\" /> inside your body tag.",
    ],
  },
];

export function EmbedSnippet({ embedKey }: EmbedSnippetProps) {
  const [copied, setCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("html");

  const widgetBaseUrl =
    process.env.NEXT_PUBLIC_WIDGET_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://cdn.vouchreel.com");

  // Clean format: <script async src="https://{DOMAIN}/widget/{embedKey}.js"></script>
  const snippet = `<script async src="${widgetBaseUrl}/widget/${embedKey}.js"></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const activeGuide =
    PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Embed on Your Website</h3>
        <p className="text-xs text-muted-foreground">
          Copy and paste this lightweight script tag onto your website to start displaying your widget.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
        {/* Code Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Script Snippet
            </span>
            {copied && (
              <span className="text-xs font-semibold text-emerald-700 animate-fade-in">
                ✓ Copied to clipboard!
              </span>
            )}
          </div>

          <div className="relative flex items-center rounded-lg border bg-neutral-950 p-3 font-mono text-xs text-neutral-100 shadow-inner">
            <code
              tabIndex={0}
              aria-label="Embed script snippet"
              className="block flex-1 overflow-x-auto pr-16 select-all font-mono text-[11px] leading-relaxed text-emerald-400"
            >
              {snippet}
            </code>

            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-100 shadow hover:bg-neutral-700 active:scale-95 transition-all"
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Platform Guides */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Installation Guides by Platform
            </label>
          </div>

          {/* Platform Tab Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => setSelectedPlatform(platform.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedPlatform === platform.id
                    ? "border border-primary bg-primary/10 text-primary font-semibold"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {platform.name}
              </button>
            ))}
          </div>

          {/* Step by step list */}
          <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span>Steps for {activeGuide.name}</span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {activeGuide.instructions.map((step, idx) => (
                <li key={idx} className="pl-1">
                  <span className="text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
