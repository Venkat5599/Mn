import { NextResponse, type NextRequest } from "next/server";

/**
 * Where real-money Stakes rooms may be offered. Points rooms are always available.
 * Country comes from the host's edge header (Vercel or Cloudflare). Unknown means "not allowed".
 */
const BLOCKED = new Set(["US", "GB", "FR", "AU", "SG", "CN", "KR", "IN"]);

export function GET(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? undefined;
  const stakesAllowed = country !== undefined && country !== "XX" && !BLOCKED.has(country.toUpperCase());
  return NextResponse.json(
    { country: country ?? null, stakesAllowed },
    { headers: { "cache-control": "private, max-age=300" } },
  );
}
