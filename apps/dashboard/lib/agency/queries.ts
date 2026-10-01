import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, events, testimonials } from "@/lib/db/schema";
import { getAccessibleSpacesWithCounts } from "@/lib/auth/permissions";

export interface SpaceAgencyMetrics {
  id: string;
  name: string;
  ownerId: string;
  embedKey: string;
  createdAt: string;
  testimonialCount: number;
  role: string;
  isDirectOwner: boolean;
  impressions: number;
  plays: number;
  conversions: number;
  conversionRate: number; // percentage, e.g. 5.2
}

export interface AgencyOverviewResult {
  summary: {
    totalSpaces: number;
    totalImpressions: number;
    totalPlays: number;
    totalConversions: number;
    overallConversionRate: number;
  };
  spaces: SpaceAgencyMetrics[];
}

export interface AgencyQueryOptions {
  search?: string;
  sortBy?: "name" | "performance" | "date" | "conversions" | "plays";
  sortOrder?: "asc" | "desc";
}

/**
 * Fetches cross-space metrics and overview for the Agency cockpit.
 */
export async function getAgencyOverview(
  userId: string,
  options: AgencyQueryOptions = {}
): Promise<AgencyOverviewResult> {
  const accessibleSpaces = await getAccessibleSpacesWithCounts(userId);

  if (accessibleSpaces.length === 0) {
    return {
      summary: {
        totalSpaces: 0,
        totalImpressions: 0,
        totalPlays: 0,
        totalConversions: 0,
        overallConversionRate: 0,
      },
      spaces: [],
    };
  }

  // Fetch metrics per space from events
  const metricsList: SpaceAgencyMetrics[] = await Promise.all(
    accessibleSpaces.map(async (sp) => {
      // Event counts grouped by eventType
      const eventCounts = await db
        .select({
          eventType: events.eventType,
          count: count(),
        })
        .from(events)
        .where(eq(events.spaceId, sp.id))
        .groupBy(events.eventType);

      let impressions = 0;
      let plays = 0;
      let conversions = 0;

      for (const row of eventCounts) {
        if (row.eventType === "impression") impressions = Number(row.count);
        if (row.eventType === "play") plays = Number(row.count);
        if (row.eventType === "convert") conversions = Number(row.count);
      }

      const conversionRate =
        impressions > 0 ? Number(((conversions / impressions) * 100).toFixed(1)) : 0;

      return {
        id: sp.id,
        name: sp.name,
        ownerId: sp.ownerId,
        embedKey: sp.embedKey,
        createdAt: sp.createdAt,
        testimonialCount: sp.testimonialCount,
        role: sp.role,
        isDirectOwner: sp.isDirectOwner,
        impressions,
        plays,
        conversions,
        conversionRate,
      };
    })
  );

  // Filter by search query if provided
  let filtered = metricsList;
  if (options.search && options.search.trim()) {
    const q = options.search.toLowerCase().trim();
    filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
  }

  // Sort
  const sortBy = options.sortBy || "date";
  const sortOrder = options.sortOrder || "desc";

  filtered.sort((a, b) => {
    let comp = 0;
    if (sortBy === "name") {
      comp = a.name.localeCompare(b.name);
    } else if (sortBy === "performance") {
      comp = a.conversionRate - b.conversionRate;
    } else if (sortBy === "conversions") {
      comp = a.conversions - b.conversions;
    } else if (sortBy === "plays") {
      comp = a.plays - b.plays;
    } else {
      // date
      comp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Global aggregate summary
  const totalSpaces = metricsList.length;
  const totalImpressions = metricsList.reduce((acc, s) => acc + s.impressions, 0);
  const totalPlays = metricsList.reduce((acc, s) => acc + s.plays, 0);
  const totalConversions = metricsList.reduce((acc, s) => acc + s.conversions, 0);
  const overallConversionRate =
    totalImpressions > 0
      ? Number(((totalConversions / totalImpressions) * 100).toFixed(1))
      : 0;

  return {
    summary: {
      totalSpaces,
      totalImpressions,
      totalPlays,
      totalConversions,
      overallConversionRate,
    },
    spaces: filtered,
  };
}
