import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { generateSignatureCertificate, generateMpaSummary } from "@/lib/pdf-generation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedUser(req);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: err?.status || 401 });
  }

  try {
    const { signature_session_id } = await req.json();
    if (!signature_session_id) {
      return NextResponse.json({ error: "signature_session_id required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: session } = await supabase
      .from("signature_sessions")
      .select("id, deal_id, lead_id, org_id, signer_name, signer_email, signed_at, signer_ip, signer_user_agent, signature_data")
      .eq("id", signature_session_id)
      .eq("status", "signed")
      .single();

    if (!session || !session.signature_data) {
      return NextResponse.json({ error: "Signed session not found" }, { status: 404 });
    }

    const { data: deal } = await supabase.from("deals").select("*").eq("id", session.deal_id).single();
    const { data: owners } = await supabase.from("deal_owners").select("*").eq("lead_id", session.lead_id).order("created_at");
    const { data: lead } = await supabase.from("leads").select("id, business_name, contact_name, email, phone, monthly_volume").eq("id", session.lead_id).single();
    let partnerName: string | null = null;
    if (deal?.partner_id) {
      const { data: p } = await supabase.from("partners").select("name").eq("id", deal.partner_id).single();
      partnerName = p?.name || null;
    }

    // Delete existing signed_documents for this session
    await supabase.from("signed_documents").delete().eq("signature_session_id", session.id);

    const ts = Date.now();
    const storagePath = (name: string) => `${session.org_id}/${session.lead_id}/${name}-${ts}.pdf`;

    // 1. Signature Certificate
    const certBytes = await generateSignatureCertificate({
      businessLegalName: deal?.business_legal_name || lead?.business_name || "",
      dbaName: deal?.dba_name || "",
      signerName: session.signer_name,
      signerEmail: session.signer_email,
      signedAt: session.signed_at,
      signerIp: session.signer_ip || "",
      signerUserAgent: session.signer_user_agent || "",
      signatureDataBase64: session.signature_data,
    });
    const certPath = storagePath("signature-certificate");
    await supabase.storage.from("deal-documents").upload(certPath, certBytes, { contentType: "application/pdf" });
    await supabase.from("signed_documents").insert({
      signature_session_id: session.id,
      deal_id: session.deal_id,
      org_id: session.org_id,
      document_type: "signature_certificate",
      file_url: certPath,
    });

    // 2. MPA Summary
    const mpaBytes = await generateMpaSummary({
      deal,
      owners: owners || [],
      lead,
      partnerName,
      signerName: session.signer_name,
      signedAt: session.signed_at,
      signatureDataBase64: session.signature_data,
    });
    const mpaPath = storagePath("mpa-summary");
    await supabase.storage.from("deal-documents").upload(mpaPath, mpaBytes, { contentType: "application/pdf" });
    await supabase.from("signed_documents").insert({
      signature_session_id: session.id,
      deal_id: session.deal_id,
      org_id: session.org_id,
      document_type: "mpa_summary",
      file_url: mpaPath,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Regenerate PDFs error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Failed to regenerate" }, { status: 500 });
  }
}
