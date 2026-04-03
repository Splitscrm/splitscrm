import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitHeaders, rateLimitResponse } from "@/lib/rate-limit";
import { generateSignatureCertificate, generateMpaSummary } from "@/lib/pdf-generation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// GET /api/sign?token=xxx — load session + deal data for the signing page (public, no auth)
export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(30, rl.resetAt);
  const headers = rateLimitHeaders(30, rl.remaining, rl.resetAt);

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400, headers });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[SIGN API] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to anon key which will be blocked by RLS");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: session, error: sessionErr } = await supabase
    .from("signature_sessions")
    .select("id, status, expires_at, signed_at, signer_name, signer_email, deal_id, lead_id, partner_id, partner_ids")
    .eq("token", token)
    .single();

  if (sessionErr) console.error("[SIGN API] Session lookup error:", sessionErr.message);
  if (!session) return NextResponse.json({ error: "Invalid token" }, { status: 404, headers });

  const result: any = { session };

  if (session.deal_id) {
    const { data: deal, error: dealErr } = await supabase.from("deals").select("*").eq("id", session.deal_id).single();
    if (dealErr) console.error("[SIGN API] Deal fetch error:", dealErr.message);
    if (deal) {
      delete deal.user_id;
      result.deal = deal;
      if (deal.partner_id) {
        const { data: partner } = await supabase.from("partners").select("id, name").eq("id", deal.partner_id).single();
        if (partner) result.partner = partner;
      }
      // Multi-partner: fetch all partner names
      const pids: string[] = session.partner_ids || [];
      if (pids.length > 1) {
        const { data: allPartners } = await supabase.from("partners").select("id, name").in("id", pids);
        if (allPartners) result.partners = allPartners;
      }
      if (deal.bank_routing) result.deal.bank_routing = "****" + deal.bank_routing.slice(-4);
      if (deal.bank_account) result.deal.bank_account = "****" + deal.bank_account.slice(-4);
    }
  }

  if (session.lead_id) {
    const { data: lead, error: leadErr } = await supabase.from("leads").select("id, business_name, contact_name, email, phone, monthly_volume").eq("id", session.lead_id).single();
    if (leadErr) console.error("[SIGN API] Lead fetch error:", leadErr.message);
    if (lead) result.lead = lead;

    // Fetch ALL deals for the lead (multi-location support)
    const { data: allDeals } = await supabase.from("deals").select("*").eq("lead_id", session.lead_id).order("created_at");
    if (allDeals && allDeals.length > 1) {
      result.deals = allDeals.map((d: any) => {
        const masked = { ...d };
        delete masked.user_id;
        if (masked.bank_routing) masked.bank_routing = "****" + masked.bank_routing.slice(-4);
        if (masked.bank_account) masked.bank_account = "****" + masked.bank_account.slice(-4);
        return masked;
      });
    }

    const { data: owners, error: ownerErr } = await supabase
      .from("deal_owners")
      .select("id, full_name, title, ownership_pct, dob, email, phone, address, city, state, zip, dl_state, dl_expiration, citizenship, is_us_resident, is_control_prong, ssn_encrypted")
      .eq("lead_id", session.lead_id)
      .order("created_at");
    if (ownerErr) console.error("[SIGN API] Owners fetch error:", ownerErr.message);
    if (owners) {
      result.owners = owners.map((o: any) => ({
        ...o,
        ssn_display: o.ssn_encrypted ? "***-**-" + o.ssn_encrypted.slice(-4) : null,
        ssn_encrypted: undefined,
      }));
    }
  }

  console.log("[SIGN API] Response:", { hasSession: !!session, hasDeal: !!result.deal, hasLead: !!result.lead, dealCount: result.deals?.length || 1, ownerCount: result.owners?.length || 0 });
  return NextResponse.json(result, { headers });
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
      .select("id, status, expires_at, lead_id, deal_id, org_id, signer_name, signer_email, partner_id, partner_ids")
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

    // Build data snapshot of critical fields at signing time
    let signedDataSnapshot: any = null;
    let dbaName = "";
    if (session.deal_id) {
      const { data: dealRow } = await supabase.from("deals").select("business_legal_name, dba_name, location_name, ein_itin, monthly_volume, pricing_type").eq("id", session.deal_id).single();
      dbaName = dealRow?.location_name || dealRow?.dba_name || "";
      if (dealRow) {
        const { data: ownerRows } = await supabase.from("deal_owners").select("full_name, ownership_pct").eq("lead_id", session.lead_id).order("created_at");
        signedDataSnapshot = {
          business_legal_name: dealRow.business_legal_name || null,
          dba_name: dealRow.dba_name || null,
          ein_itin: dealRow.ein_itin || null,
          monthly_volume: dealRow.monthly_volume || null,
          pricing_type: dealRow.pricing_type || null,
          owners: (ownerRows || []).map((o: any) => ({ full_name: o.full_name || null, ownership_pct: o.ownership_pct || null })),
        };
      }
    }

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
        signed_data_snapshot: signedDataSnapshot,
      })
      .eq("id", session.id);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to save signature" }, { status: 500, headers });
    }

    // Fetch full data for PDF generation and multi-partner cloning
    const { data: fullDeal } = await supabase.from("deals").select("*").eq("id", session.deal_id).single();
    const { data: fullOwners } = await supabase.from("deal_owners").select("*").eq("lead_id", session.lead_id).order("created_at");
    const { data: fullLead } = await supabase.from("leads").select("id, business_name, contact_name, email, phone, monthly_volume").eq("id", session.lead_id).single();
    // Fetch ALL deals for multi-location PDF generation
    const { data: allLeadDeals } = await supabase.from("deals").select("*").eq("lead_id", session.lead_id).order("created_at");
    const dealsForPdf = (allLeadDeals && allLeadDeals.length > 1) ? allLeadDeals : [fullDeal].filter(Boolean);
    const ts = Date.now();

    // ── Generate PDFs (non-blocking — errors are logged but don't fail the signing) ──
    try {
      const storagePath = (name: string) => `${session.org_id}/${session.lead_id}/${name}-${ts}.pdf`;

      // 1. Shared Signature Certificate (one for all locations)
      const certBytes = await generateSignatureCertificate({
        businessLegalName: fullDeal?.business_legal_name || fullLead?.business_name || "",
        dbaName: fullDeal?.dba_name || "",
        signerName: session.signer_name,
        signerEmail: session.signer_email,
        signedAt: now,
        signerIp,
        signerUserAgent,
        signatureDataBase64: signature_data,
      });
      const certPath = storagePath("signature-certificate");
      const { error: certUpErr } = await supabase.storage.from("deal-documents").upload(certPath, certBytes, { contentType: "application/pdf" });
      if (certUpErr) console.error("Cert upload error:", certUpErr.message);
      else {
        await supabase.from("signed_documents").insert({
          signature_session_id: session.id,
          deal_id: session.deal_id,
          org_id: session.org_id,
          document_type: "signature_certificate",
          file_url: certPath,
        });
      }

      // 2. Per-deal MPA Summaries (one per location)
      for (const dealForPdf of dealsForPdf) {
        if (!dealForPdf) continue;
        let partnerName: string | null = null;
        if (dealForPdf.partner_id) {
          const { data: p } = await supabase.from("partners").select("name").eq("id", dealForPdf.partner_id).single();
          partnerName = p?.name || null;
        }
        const locationSlug = dealsForPdf.length > 1
          ? `-${(dealForPdf.location_name || dealForPdf.dba_name || dealForPdf.id.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`
          : "";
        const mpaBytes = await generateMpaSummary({
          deal: dealForPdf,
          owners: fullOwners || [],
          lead: fullLead,
          partnerName,
          signerName: session.signer_name,
          signedAt: now,
          signatureDataBase64: signature_data,
        });
        const mpaPath = storagePath(`mpa-summary${locationSlug}`);
        const { error: mpaUpErr } = await supabase.storage.from("deal-documents").upload(mpaPath, mpaBytes, { contentType: "application/pdf" });
        if (mpaUpErr) console.error("MPA upload error:", mpaUpErr.message);
        else {
          await supabase.from("signed_documents").insert({
            signature_session_id: session.id,
            deal_id: dealForPdf.id,
            org_id: session.org_id,
            document_type: "mpa_summary",
            file_url: mpaPath,
          });
        }
      }
    } catch (pdfErr: any) {
      console.error("PDF generation failed (signature still saved):", pdfErr?.message || pdfErr);
    }

    // ── Multi-partner: create per-partner sessions for additional partners ──
    const partnerIds: string[] = session.partner_ids || [];
    if (partnerIds.length > 1) {
      try {
        const additionalPartners = partnerIds.filter((pid: string) => pid !== session.partner_id);
        for (const pid of additionalPartners) {
          const { data: clonedSession } = await supabase.from("signature_sessions").insert({
            org_id: session.org_id,
            deal_id: session.deal_id,
            lead_id: session.lead_id,
            partner_id: pid,
            token: crypto.randomUUID(),
            signer_name: session.signer_name,
            signer_email: session.signer_email,
            signer_ip: signerIp,
            signer_user_agent: signerUserAgent,
            signature_data,
            consent_given: true,
            signed_at: now,
            signed_data_snapshot: signedDataSnapshot,
            reused_from_session_id: session.id,
            status: "signed",
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }).select("id").single();

          // Generate PDFs for this partner session
          if (clonedSession?.id) {
            try {
              let clonePartnerName: string | null = null;
              const { data: cp } = await supabase.from("partners").select("name").eq("id", pid).single();
              clonePartnerName = cp?.name || null;

              const cloneCertBytes = await generateSignatureCertificate({
                businessLegalName: fullDeal?.business_legal_name || fullLead?.business_name || "",
                dbaName: fullDeal?.dba_name || "",
                signerName: session.signer_name,
                signerEmail: session.signer_email,
                signedAt: now,
                signerIp,
                signerUserAgent,
                signatureDataBase64: signature_data,
              });
              const cloneCertPath = `${session.org_id}/${session.lead_id}/signature-certificate-${pid.slice(0, 8)}-${ts}.pdf`;
              const { error: ccErr } = await supabase.storage.from("deal-documents").upload(cloneCertPath, cloneCertBytes, { contentType: "application/pdf" });
              if (!ccErr) {
                await supabase.from("signed_documents").insert({ signature_session_id: clonedSession.id, deal_id: session.deal_id, org_id: session.org_id, document_type: "signature_certificate", file_url: cloneCertPath });
              }

              const cloneMpaBytes = await generateMpaSummary({
                deal: fullDeal, owners: fullOwners || [], lead: fullLead, partnerName: clonePartnerName,
                signerName: session.signer_name, signedAt: now, signatureDataBase64: signature_data,
              });
              const cloneMpaPath = `${session.org_id}/${session.lead_id}/mpa-summary-${pid.slice(0, 8)}-${ts}.pdf`;
              const { error: cmErr } = await supabase.storage.from("deal-documents").upload(cloneMpaPath, cloneMpaBytes, { contentType: "application/pdf" });
              if (!cmErr) {
                await supabase.from("signed_documents").insert({ signature_session_id: clonedSession.id, deal_id: session.deal_id, org_id: session.org_id, document_type: "mpa_summary", file_url: cloneMpaPath });
              }
            } catch (clonePdfErr: any) {
              console.error("PDF generation for partner clone failed:", clonePdfErr?.message);
            }
          }
        }
      } catch (cloneErr: any) {
        console.error("Multi-partner session cloning failed:", cloneErr?.message);
      }
    }

    // Multi-location: only update lead to 'signed' if ALL deals have signed sessions
    if (session.lead_id) {
      const { data: allDeals } = await supabase.from("deals").select("id").eq("lead_id", session.lead_id);
      const dealIds = (allDeals || []).map((d: any) => d.id);
      let allSigned = true;
      if (dealIds.length > 1) {
        for (const did of dealIds) {
          if (did === session.deal_id) continue; // this one is being signed right now
          const { data: otherSessions } = await supabase.from("signature_sessions").select("status").eq("deal_id", did).eq("status", "signed").limit(1);
          if (!otherSessions || otherSessions.length === 0) { allSigned = false; break; }
        }
      }
      if (allSigned) {
        await supabase.from("leads").update({ status: "signed", updated_at: now }).eq("id", session.lead_id);
      }

      // Create activity log entry
      await supabase.from("activity_log").insert({
        org_id: session.org_id,
        lead_id: session.lead_id,
        deal_id: session.deal_id,
        action_type: "mpa_signed",
        description: `MPA signed by ${session.signer_name} (${session.signer_email})${dbaName ? ` for ${dbaName}` : ""}`,
      });
    }

    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500, headers });
  }
}
