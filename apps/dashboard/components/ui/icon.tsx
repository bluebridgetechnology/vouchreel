import { getIconData, iconToSVG } from "@iconify/utils";
import { iconCollection, type IconName } from "@/lib/icons.generated";
import { cn } from "@/lib/utils";

// Icon data comes from the bundled subset (see scripts/build-icons.mjs) and is rendered
// as inline SVG on the server: no client JS, no Iconify API requests, no empty first paint.

const sizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
} as const;

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: IconName;
  size?: keyof typeof sizes;
}

/** Solar Outline icon. Colour follows `currentColor`; size via the `size` prop. */
export function Icon({ name, size = "md", className, ...props }: IconProps) {
  const data = getIconData(iconCollection, `${name}-outline`);
  if (!data) return null;
  const { attributes, body } = iconToSVG(data, { width: "100%", height: "100%" });
  return (
    <span
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("inline-flex shrink-0", sizes[size], className)}
      {...props}
    >
      <svg {...attributes} fill="currentColor" className="size-full" dangerouslySetInnerHTML={{ __html: body }} />
    </span>
  );
}
