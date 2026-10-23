import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { log } from "@/lib/log";

/**
 * The lowest monthly price of any paid plan, in whole dollars, for the landing page ("from $19 a month").
 * Prices are edited in the admin area, so they are read, not written into the page. Null when there is no
 * paid monthly plan or the database cannot be reached: the page then leaves the number out instead of failing.
 */
export async function getStartingMonthlyPrice(): Promise<number | null> {
  try {
    const rows = await db.query.plans.findMany({
      where: and(eq(plans.isActive, true), eq(plans.interval, "month"), gt(plans.price, 0)),
      columns: { price: true },
    });
    if (rows.length === 0) return null;
    return Math.round(Math.min(...rows.map((r) => r.price)) / 100);
  } catch (err) {
    log.warn("Could not read plan prices for the landing page:", err);
    return null;
  }
}
