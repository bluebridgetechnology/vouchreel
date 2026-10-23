import { cn } from "@/lib/utils";

/**
 * The tools Vouchreel works with, drawn from the logo files in public/integrations (from brand_logo/).
 * Width and height are each file's own proportions, so nothing shifts while they load.
 */
export const brands = [
  { name: "Shopify", file: "shopify", width: 99, height: 28 },
  { name: "WordPress", file: "wordpress", width: 28, height: 28, label: true },
  { name: "Webflow", file: "webflow", width: 168, height: 28 },
  { name: "Framer", file: "framer", width: 124, height: 28 },
  { name: "Zapier", file: "zapier", width: 103, height: 28 },
  { name: "Make", file: "make", width: 136, height: 28 },
  { name: "API and webhooks", file: "api-webhook", width: 28, height: 28, label: true },
];

export type Brand = (typeof brands)[number];

/** A logo, with the brand's name beside it when the file is only a mark (so the name is text, and the image is decoration). */
export function BrandMark({ brand, className }: { brand: Brand; className?: string }) {
  return (
    <>
      {/* Plain <img>: small vector files, so there is nothing for the image optimiser to do. The files are black or
          coloured, so in dark mode they are made grey and then white. */}
      <img
        src={`/integrations/${brand.file}.svg`}
        alt={brand.label ? "" : brand.name}
        width={brand.width}
        height={brand.height}
        loading="lazy"
        className={cn("h-5 w-auto shrink-0 dark:grayscale dark:invert", className)}
      />
      {brand.label && <span className="text-sm font-medium text-text-muted">{brand.name}</span>}
    </>
  );
}
