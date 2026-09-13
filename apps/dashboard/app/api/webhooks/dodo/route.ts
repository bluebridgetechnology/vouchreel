import { NextResponse } from "next/server";
import { DodoProvider } from "@/lib/payments/dodo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const provider = new DodoProvider();
    const result = await provider.handleWebhook(request);

    if (!result.received) {
      return NextResponse.json(
        { error: result.error || "Failed to process Dodo webhook" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      received: true,
      event: result.event,
      actionTaken: result.actionTaken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
