import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitHeaders, rateLimitResponse } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(5, rl.resetAt);
  const headers = rateLimitHeaders(5, rl.remaining, rl.resetAt);

  try {
    const { token, signature_data, consent } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400, headers });
    }
    if (!signature_data || typeof signature_data !== "string") {
      return NextResponse.json({ error: "Signature is required" }, { status: 400, headers });
    }
    if (!consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400, headers });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up session
    const { data: session, error: sessionErr } = await supabase
      .from("signature_sessions")
      .select("id, status, expires_at, lead_id, deal_id")
      .eq("token", token)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404, headers });
    }

    if (session.status !== "pending") {
      return NextResponse.json({ error: `This session is already ${session.status}` }, { status: 400, headers });
    }

    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("signature_sessions").update({ status: "expired" }).eq("id", session.id);
      return NextResponse.json({ error: "This signing link has expired" }, { status: 400, headers });
    }

    const now = new Date().toISOString();
    const signerIp = getClientIp(req);
    const signerUserAgent = req.headers.get("user-agent") || "";

    // Update signature session
    const { error: updateErr } = await supabase
      .from("signature_sessions")
      .update({
        status: "signed",
        signed_at: now,
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        signature_data,
        consent_given: true,
      })
      .eq("id", session.id);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to save signature" }, { status: 500, headers });
    }

    // Update lead status to 'signed'
    if (session.lead_id) {
      await supabase.from("leads").update({ status: "signed", updated_at: now }).eq("id", session.lead_id);
    }

    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500, headers });
  }
}
