"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toggleStyle } from "@/components/ui/toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
      "Option 1 (Plugin): Install the official VouchReel WordPress plugin from wp-content/plugins/vouchreel and enter your embed key in Settings → VouchReel.",
      "Option 2 (Gutenberg): Insert the 'VouchReel Widget' block directly into any page or post.",
      "Option 3 (Script): Install 'WPCode' (or any header/footer injection plugin) via Plugins → Add New, go to Code Snippets → Header & Footer, paste the script snippet into the 'Footer' box, and click 'Save Changes'.",
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    instructions: [
      "In Shopify Admin, go to Online Store → Themes.",
      "Click '...' next to your active theme → 'Edit code'.",
      "Under Layout, open theme.liquid and paste the script snippet right before </body>.",
      "For product-specific matching: paste the snippet into product templates with data-tags=\"product-{{ product.id }}\".",
      "Click 'Save' in the top right corner.",
    ],
  },
  {
    id: "framer",
    name: "Framer",
    instructions: [
      "In Framer, open your Project Settings → General → Custom Code.",
      "Paste the script snippet into the End of <body> section and publish.",
      "Or create a custom Code Component using the Vouchreel React snippet from our Framer guide.",
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

  // Dynamic snippet formatting based on selected platform
  let snippet = `<script async src="${widgetBaseUrl}/widget/${embedKey}.js"></script>`;

  if (selectedPlatform === "shopify") {
    snippet = `<script async src="${widgetBaseUrl}/widget/${embedKey}.js" data-key="${embedKey}"{% if product %} data-tags="product-{{ product.id }}"{% endif %}></script>`;
  } else if (selectedPlatform === "nextjs") {
    snippet = `<Script async strategy="afterInteractive" src="${widgetBaseUrl}/widget/${embedKey}.js" />`;
  }

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
        <h3 className="text-sm font-medium text-text">Embed on Your Website</h3>
        <p className="text-xs text-text-muted">
          Copy and paste this lightweight script tag onto your website to start displaying your widget.
        </p>
      </div>

      <Card variant="flat" className="space-y-5 p-4 sm:p-5">
        {/* Code Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text">
              Script Snippet
            </span>
            {copied && (
              <span className="text-xs font-medium text-success-foreground animate-fade-in">
                ✓ Copied to clipboard!
              </span>
            )}
          </div>

          <div className="relative flex items-center rounded-card border bg-surface-inverse p-3 font-mono text-xs text-text-inverse">
            <code
              tabIndex={0}
              aria-label="Embed script snippet"
              className="block flex-1 overflow-x-auto pr-16 select-all font-mono text-2xs leading-relaxed text-success"
            >
              {snippet}
            </code>

            <button
              type="button"
              onClick={handleCopy}
              className={cn(buttonVariants({ variant: "outline-inverse", size: "sm" }), "absolute right-2")}
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Platform Guides */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text">
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
                className={cn("rounded-control px-2.5 py-1 text-xs font-medium transition-colors", toggleStyle("choice", selectedPlatform === platform.id))}
              >
                {platform.name}
              </button>
            ))}
          </div>

          {/* Step by step list */}
          <Card variant="flat" className="bg-surface-sunken/20 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text">
              <span>Steps for {activeGuide.name}</span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-muted leading-relaxed">
              {activeGuide.instructions.map((step, idx) => (
                <li key={idx} className="pl-1">
                  <span className="text-text/90">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </Card>
    </div>
  );
}
