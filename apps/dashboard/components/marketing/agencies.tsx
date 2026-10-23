import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";
import type { IconName } from "@/lib/icons.generated";

const points: { title: string; description: string; icon: IconName }[] = [
  {
    icon: "users-group-rounded",
    title: "Teams with roles",
    description: "Invite owners, editors and viewers, so everyone on your team has the access their job needs and no more.",
  },
  {
    icon: "buildings-2",
    title: "Your brand, your domain",
    description: "White label the widget and the dashboard with your own branding and a custom domain for every client.",
  },
  {
    icon: "chart-square",
    title: "Every client in one view",
    description: "A cockpit across all the sites you run, with ROI reports as PDF and CSV to show clients it works.",
  },
];

/** The agency section: a centred heading, three cards that gain a brand-coloured top edge on hover, and a link to the plans. */
export function Agencies() {
  return (
    <section>
      <Container className="py-8 sm:py-16 lg:py-20">
        <div className="flex flex-col gap-8 md:gap-16">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
            <Badge variant="eyebrow">For agencies</Badge>
            <h2 className="text-4xl font-medium sm:text-5xl">
              Run it for <Em>every client</Em>
            </h2>
            <p className="text-text-muted">
              One account for all the sites you manage, under your own brand, with the numbers to show clients it works.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {points.map((point) => (
              <li key={point.title}>
                <Card className="h-full border-t-4 border-t-transparent py-10 transition-all duration-300 hover:border-t-brand hover:shadow-float">
                  <CardContent className="flex flex-col gap-6 px-8">
                    <Icon name={point.icon} size="xl" className="text-brand" />
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xl font-medium">{point.title}</h3>
                      <p className="text-text-muted">{point.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-center gap-5">
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Icon name="star-ring" size="sm" /> Managing many sites? One account covers them all.
            </p>
            <Button asChild>
              <Link href="/pricing">See agency plans</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
