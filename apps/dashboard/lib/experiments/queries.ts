import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, experiments, spaces } from "@/lib/db/schema";
import { calculateZTest, ZTestResult } from "./stats";

export interface VariantStats {
  id: string;
  name: string;
  config: Record<string, unknown>;
  trafficSplit: number;
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  clickThroughRate: number;
  playRate: number;
  significance?: ZTestResult | null;
}

export interface ExperimentWithStats {
  id: string;
  spaceId: string;
  name: string;
  type: "trigger" | "position" | "template";
  status: "draft" | "running" | "completed";
  winnerVariantIndex: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  trafficSplit: number[];
  variants: VariantStats[];
  totalImpressions: number;
  totalPlays: number;
  totalClicks: number;
  totalConversions: number;
  overallConversionRate: number;
}

/**
 * Computes per-variant metrics from events table where events.metadata->>'experimentId' == experimentId.
 */
export async function getExperimentMetrics(
  spaceId: string,
  experimentId: string,
  variants: Array<{ id: string; name: string; config: Record<string, unknown> }>,
  trafficSplit: number[]
): Promise<{
  variants: VariantStats[];
  totals: { impressions: number; plays: number; clicks: number; conversions: number };
}> {
  const rows = await db
    .select({
      variantIndex: sql<string>`${events.metadata}->>'variantIndex'`,
      impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
      plays: sql<number>`count(*) filter (where ${events.eventType} = 'play')::int`,
      clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
      conversions: sql<number>`count(*) filter (where ${events.eventType} = 'convert')::int`,
    })
    .from(events)
    .where(
      and(
        eq(events.spaceId, spaceId),
        sql`${events.metadata}->>'experimentId' = ${experimentId}`
      )
    )
    .groupBy(sql`${events.metadata}->>'variantIndex'`);

  const rowMap = new Map<
    number,
    { impressions: number; plays: number; clicks: number; conversions: number }
  >();

  for (const r of rows) {
    if (r.variantIndex !== null && r.variantIndex !== undefined) {
      const idx = parseInt(String(r.variantIndex), 10);
      if (!isNaN(idx)) {
        rowMap.set(idx, {
          impressions: Number(r.impressions) || 0,
          plays: Number(r.plays) || 0,
          clicks: Number(r.clicks) || 0,
          conversions: Number(r.conversions) || 0,
        });
      }
    }
  }

  let totalImpressions = 0;
  let totalPlays = 0;
  let totalClicks = 0;
  let totalConversions = 0;

  const variantStats: VariantStats[] = variants.map((v, idx) => {
    const data = rowMap.get(idx) || {
      impressions: 0,
      plays: 0,
      clicks: 0,
      conversions: 0,
    };
    totalImpressions += data.impressions;
    totalPlays += data.plays;
    totalClicks += data.clicks;
    totalConversions += data.conversions;

    const conversionRate =
      data.impressions > 0 ? (data.conversions / data.impressions) * 100 : 0;
    const clickThroughRate =
      data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
    const playRate =
      data.impressions > 0 ? (data.plays / data.impressions) * 100 : 0;

    return {
      id: v.id,
      name: v.name,
      config: v.config || {},
      trafficSplit: trafficSplit[idx] ?? 0,
      impressions: data.impressions,
      plays: data.plays,
      clicks: data.clicks,
      conversions: data.conversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
      playRate: Math.round(playRate * 100) / 100,
    };
  });

  // Calculate statistical significance against control (variant 0)
  if (variantStats.length > 1) {
    const control = variantStats[0];
    for (let i = 1; i < variantStats.length; i++) {
      variantStats[i].significance = calculateZTest(control, variantStats[i]);
    }
  }

  return {
    variants: variantStats,
    totals: {
      impressions: totalImpressions,
      plays: totalPlays,
      clicks: totalClicks,
      conversions: totalConversions,
    },
  };
}

/**
 * Lists all experiments for a space with their variant metrics.
 */
export async function getExperimentsWithStats(
  spaceId: string
): Promise<ExperimentWithStats[]> {
  const records = await db
    .select()
    .from(experiments)
    .where(eq(experiments.spaceId, spaceId))
    .orderBy(desc(experiments.createdAt));

  const results: ExperimentWithStats[] = [];

  for (const exp of records) {
    const { variants, totals } = await getExperimentMetrics(
      spaceId,
      exp.id,
      exp.variants || [],
      exp.trafficSplit || []
    );

    const overallConversionRate =
      totals.impressions > 0
        ? Math.round((totals.conversions / totals.impressions) * 10000) / 100
        : 0;

    results.push({
      id: exp.id,
      spaceId: exp.spaceId,
      name: exp.name,
      type: exp.type,
      status: exp.status,
      winnerVariantIndex: exp.winnerVariantIndex,
      startedAt: exp.startedAt,
      endedAt: exp.endedAt,
      createdAt: exp.createdAt,
      trafficSplit: exp.trafficSplit,
      variants,
      totalImpressions: totals.impressions,
      totalPlays: totals.plays,
      totalClicks: totals.clicks,
      totalConversions: totals.conversions,
      overallConversionRate,
    });
  }

  return results;
}
