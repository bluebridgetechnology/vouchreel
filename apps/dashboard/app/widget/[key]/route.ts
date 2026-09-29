import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface RouteParams {
  params: Promise<{ key: string }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * GET /widget/[key]
 * Serves the compiled embed widget JavaScript file.
 * Handles /widget/{embedKey}.js, /widget/vouchreel-widget.js, etc.
 */
export async function GET(request: Request, { params }: RouteParams) {
  // Statically scoped to public/widget directory
  const filePath = path.join(process.cwd(), "public", "widget", "vouchreel-widget.js");

  let scriptContent = "";
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      scriptContent = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
    }
  } catch {
    // Fallback if read fails
  }

  if (!scriptContent) {
    scriptContent = `/** Vouchreel Embed Widget Bootstrap **/
(function() {
  console.warn("Vouchreel widget bundle not found or pending build.");
})();`;
  }

  return new NextResponse(scriptContent, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
