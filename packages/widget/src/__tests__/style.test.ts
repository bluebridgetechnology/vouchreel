import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { applyTheme } from "../style";

function root() {
  const vars: Record<string, string> = {};
  const classes = new Set<string>();
  const el: any = {
    vars,
    classes,
    style: { setProperty: (k: string, v: string) => (vars[k] = v) },
    classList: { add: (c: string) => classes.add(c) },
  };
  return el;
}

describe("applying a widget theme", () => {
  it("does nothing without a theme, so the stylesheet defaults apply", () => {
    const r = root();
    applyTheme(r, undefined);
    expect(r.vars).toEqual({});
    expect(r.classes.size).toBe(0);
  });

  it("sets colours, radius and sizes as CSS variables", () => {
    const r = root();
    applyTheme(r, {
      primaryColor: "#112233",
      accentColor: "#ffffff",
      borderRadius: 20,
      background: "#000000",
      textColor: "#eeeeee",
      borderColor: "#ff0000",
      borderWidth: 2,
      columns: 4,
    });
    expect(r.vars).toMatchObject({
      "--vr-primary": "#112233",
      "--vr-accent": "#ffffff",
      "--vr-radius": "20px",
      "--vr-bg": "#000000",
      "--vr-sheet-bg": "#000000",
      "--vr-text": "#eeeeee",
      "--vr-border": "#ff0000",
      "--vr-border-w": "2px",
      "--vr-cols": "4",
    });
    expect(r.vars["--vr-text-muted"]).toContain("#eeeeee");
  });

  it("leaves mode-driven colours alone when background and text are not chosen (null)", () => {
    const r = root();
    applyTheme(r, { background: null, textColor: null, borderColor: null, borderWidth: 0 });
    expect(r.vars).toEqual({ "--vr-border-w": "0px" });
  });

  it("turns choices into classes the stylesheet styles", () => {
    const r = root();
    applyTheme(r, {
      mode: "dark",
      size: "lg",
      shadow: "strong",
      shape: "vertical",
      gap: "tight",
      entrance: "pop",
      playButtonStyle: "minimal",
      glass: true,
      showName: true,
      showCompany: false,
      showStars: false,
      showSource: false,
      showQuote: false,
    });
    expect([...r.classes].sort()).toEqual(
      [
        "vr-dark",
        "vr-size-lg",
        "vr-shadow-strong",
        "vr-shape-vertical",
        "vr-gap-tight",
        "vr-enter-pop",
        "vr-play-minimal",
        "vr-glass",
        "vr-hide-company",
        "vr-hide-stars",
        "vr-hide-source",
        "vr-hide-quote",
      ].sort()
    );
  });

  it("ignores class values that are not plain tokens (an experiment's config can carry a theme)", () => {
    const r = root();
    applyTheme(r, { size: "lg evil", shadow: "<x>", shape: "a b" });
    expect(r.classes.size).toBe(0);
  });

  it("every class it can add has a rule in some stylesheet", () => {
    const sheets = [
      readFileSync(new URL("../styles.css", import.meta.url), "utf8"),
      ...readdirSync(new URL("../layouts/", import.meta.url))
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(new URL(`../layouts/${f}`, import.meta.url), "utf8")),
    ].join("\n");
    const expected = [
      "vr-size-sm",
      "vr-size-lg",
      "vr-shadow-none",
      "vr-shadow-strong",
      "vr-gap-tight",
      "vr-gap-loose",
      "vr-glass",
      "vr-hide-name",
      "vr-hide-company",
      "vr-hide-stars",
      "vr-hide-source",
      "vr-hide-quote",
      "vr-play-solid",
      "vr-play-minimal",
      "vr-enter-none",
      "vr-enter-fade",
      "vr-enter-pop",
      "vr-shape-circle",
      "vr-shape-square",
      "vr-shape-rounded",
      "vr-shape-landscape",
      "vr-shape-portrait",
      "vr-shape-vertical",
    ];
    for (const cls of expected) expect(sheets, cls).toContain(`.${cls}`);
  });
});
