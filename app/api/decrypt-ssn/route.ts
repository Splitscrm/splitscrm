import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";
import { getAuthenticatedUser, requireRole } from "@/lib/api-auth";
import { rateLimit, rateLimitHeaders, rateLimitResponse } from "@/lib/rate-limit";

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: RATE_LIMIT, windowMs: WINDOW_MS });
  if (!rl.success) return rateLimitResponse(RATE_LIMIT, rl.resetAt);
  const headers = rateLimitHeaders(RATE_LIMIT, rl.remaining, rl.resetAt);

  try {
    const { user, supabase } = await getAuthenticatedUser(req);

    const { encrypted, deal_owner_id } = await req.json();
    if (!encrypted || typeof encrypted !== "string") {
      return NextResponse.json({ error: "Encrypted value is required" }, { status: 400, headers });
    }

    // Permission check: must be owner/manager or have explicit decrypt_ssn permission
    const { data: memberData } = await supabase
      .from("org_members")
      .select("role, permissions")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "No active organization membership" }, { status: 403, headers });
    }

    const hasExplicitPerm = memberData.permissions?.decrypt_ssn === true;
    if (!["owner", "manager"].includes(memberData.role) && !hasExplicitPerm) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers });
    }

    const plaintext = decrypt(encrypted);

    // Audit log
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action_type: "ssn_revealed",
      field_name: "ssn",
      description: `SSN revealed for deal owner ${deal_owner_id || "unknown"}`,
    });

    return NextResponse.json({ ssn: plaintext }, { headers });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    }
    console.error("Decrypt SSN error:", err);
    return NextResponse.json({ error: "Decryption failed" }, { status: 500, headers });
  }
}
