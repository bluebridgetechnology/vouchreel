import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeView } from "../home-view";
import type { HomeData } from "@/lib/home/queries";

const metric = (current: number, previous: number) => ({ current, previous, series: [current] });
const steps = (done: boolean[]) =>
  ["space", "testimonial", "widget", "install", "collect"].map((key, i) => ({ key, label: `Step ${key}`, done: done[i], href: `/go/${key}` }));

const base: HomeData = {
  range: 7,
  spaces: [{ id: "s1", name: "Acme", testimonialCount: 4, plays: 12, series: [1, 2, 3] }],
  pulse: { impressions: metric(200, 100), plays: metric(25, 25), conversions: metric(0, 0) },
  spotlight: null,
  checklist: steps([true, true, true, true, true]),
  needs: { pending: [], pendingThumbnails: [], failedUploads: 0, reviewSourceErrors: [], limits: [] },
  faces: [],
};

const render = (over: Partial<HomeData> = {}) => renderToStaticMarkup(<HomeView data={{ ...base, ...over }} firstName="Ada" />);

describe("home page", () => {
  it("greets the owner and shows the numbers in words", () => {
    const html = render();
    expect(html).toContain("Ada");
    expect(html).toContain("up 100%"); // impressions doubled
    expect(html).toContain("no change"); // plays flat
    expect(html).toContain("13%"); // play rate 25/200
    expect(html).not.toContain("new this period");
  });

  it("puts the setup steps in the hero for a new account, with the next step as the one button", () => {
    const html = render({ checklist: steps([true, false, false, false, false]) });
    expect(html).toContain("1 of 5 done");
    expect(html).toContain('href="/go/testimonial"');
    expect(html).not.toContain("Spotlight");
  });

  it("leaves out the numbers until there has been any activity", () => {
    const zero = { current: 0, previous: 0, series: [0] };
    expect(render()).toContain("Play rate");
    expect(render({ pulse: { impressions: zero, plays: zero, conversions: zero } })).not.toContain("Play rate");
  });

  it("puts the week's best video in the hero when there is one", () => {
    const html = render({
      spotlight: {
        testimonial: { id: "t1", spaceId: "s1", spaceName: "Acme", customerName: "Sarah Chen", customerCompany: "Northwind", quote: "We doubled our demos", thumbnailUrl: "https://cdn.test/t.jpg", videoUrl: "https://cdn.test/v.mp4", platform: "mp4" },
        plays: 41,
        convertingViewers: 3,
      },
    });
    expect(html).toContain("Spotlight");
    expect(html).toContain("We doubled our demos");
    expect(html).toContain("Sarah&#x27;s video was played 41 times this week, and 3 viewers went on to convert.");
    expect(html).toContain('href="/spaces/s1/social"');
  });

  it("says when it was a quiet week instead of showing an empty spotlight", () => {
    expect(render()).toContain("quiet");
  });

  it("lists only what needs the owner, and says so when nothing does", () => {
    expect(render()).toContain("Nothing needs you right now.");
    const html = render({
      needs: {
        pending: [{ spaceId: "s1", spaceName: "Acme", count: 3 }],
        pendingThumbnails: [],
        failedUploads: 1,
        reviewSourceErrors: [],
        limits: [{ label: "Spaces", used: 1, max: 1, href: "/settings/billing" }],
      },
    });
    expect(html).toContain("new submissions to review in Acme");
    expect(html).toContain("1 upload could not be processed");
    expect(html).toContain("1 of 1");
    expect(html).not.toContain("Nothing needs you");
  });

  it("shows faces only when there are some", () => {
    expect(render()).not.toContain("voices");
    expect(render({ faces: [{ id: "t", spaceId: "s1", customerName: "Jo", thumbnailUrl: null }] })).toContain("voices");
  });
});
