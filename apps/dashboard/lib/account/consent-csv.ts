import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { csvCell } from "@/lib/admin/csv";
import { submissions, testimonialConsents, testimonials } from "@/lib/db/schema";

export { csvCell };

const HEADER = ["testimonial_id", "customer_name", "customer_email", "kind", "source", "wording_version", "granted_at", "withdrawn_at"];

/** Every consent record of a space as CSV: who agreed to what wording, when, how, and whether it was withdrawn. */
export async function consentsCsv(spaceId: string): Promise<string> {
  const rows = await db
    .select({
      testimonialId: testimonialConsents.testimonialId,
      customerName: testimonials.customerName,
      customerEmail: submissions.customerEmail,
      kind: testimonialConsents.kind,
      source: testimonialConsents.source,
      textVersion: testimonialConsents.textVersion,
      grantedAt: testimonialConsents.grantedAt,
      revokedAt: testimonialConsents.revokedAt,
    })
    .from(testimonialConsents)
    .innerJoin(testimonials, eq(testimonials.id, testimonialConsents.testimonialId))
    .leftJoin(submissions, eq(submissions.id, testimonialConsents.submissionId))
    .where(eq(testimonialConsents.spaceId, spaceId))
    .orderBy(desc(testimonialConsents.grantedAt));
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push([r.testimonialId, r.customerName, r.customerEmail, r.kind, r.source, r.textVersion, r.grantedAt, r.revokedAt].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
