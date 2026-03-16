import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { rateLimit, rateLimitHeaders, rateLimitResponse } from "@/lib/rate-limit";

const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: RATE_LIMIT, windowMs: WINDOW_MS });
  if (!rl.success) return rateLimitResponse(RATE_LIMIT, rl.resetAt);
  const headers = rateLimitHeaders(RATE_LIMIT, rl.remaining, rl.resetAt);

  try {
    await getAuthenticatedUser(req);

    const { ssn } = await req.json();
    if (!ssn || typeof ssn !== "string") {
      return NextResponse.json({ error: "SSN is required" }, { status: 400, headers });
    }

    const encrypted = encrypt(ssn);
    return NextResponse.json({ encrypted }, { headers });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    }
    console.error("Encrypt SSN error:", err);
    return NextResponse.json({ error: "Encryption failed" }, { status: 500, headers });
  }
}
