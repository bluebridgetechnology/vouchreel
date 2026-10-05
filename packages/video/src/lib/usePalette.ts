import { useMemo } from "react";
import { derivePalette, type Palette } from "./palette";
import type { BackgroundStyle, ReviewVideoProps } from "../types";

/**
 * The palette for a composition: the customer's brand colour and theme, with the template's own
 * default style when they did not choose one.
 */
export function usePalette(props: Pick<ReviewVideoProps, "brand" | "theme">, defaultStyle: BackgroundStyle): Palette {
  const style = props.theme?.style ?? defaultStyle;
  const secondary = props.theme?.secondary;
  return useMemo(() => derivePalette(props.brand, { style, secondary }), [props.brand, style, secondary]);
}
