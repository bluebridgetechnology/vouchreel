"use client";

import { use } from "react";
import { ExperimentsView } from "@/components/experiments/experiments-view";

interface SpaceExperimentsPageProps {
  params: Promise<{ id: string }>;
}

export default function SpaceExperimentsPage({ params }: SpaceExperimentsPageProps) {
  const { id: spaceId } = use(params);

  return <ExperimentsView spaceId={spaceId} />;
}
