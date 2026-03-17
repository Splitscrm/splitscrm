"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PageState = "loading" | "invalid" | "expired" | "signed" | "revoked" | "signing" | "success";

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>("loading");
  const [session, setSession] = useState<any>(null);
  const [deal, setDeal] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [owners, setOwners] = useState<any[]>([]);
  const [partner, setPartner] = useState<any>(null);

  // Signature state
  const [consent, setConsent] = useState(false);
  const [sigMode, setSigMode] = useState<"type" | "draw">("type");
  const [typedSig, setTypedSig] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    loadSession();
  }, [token]);

  const loadSession = async () => {
    const { data, error } = await supabase
      .from("signature_sessions")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !data) { setState("invalid"); return; }

    setSession(data);

    if (data.status === "signed") { setState("signed"); return; }
    if (data.status === "revoked") { setState("revoked"); return; }
    if (new Date(data.expires_at) < new Date()) { setState("expired"); return; }

    // Load deal, lead, owners, partner for the application summary
    if (data.deal_id) {
      const { data: d } = await supabase.from("deals").select("*").eq("id", data.deal_id).single();
      if (d) setDeal(d);
      if (d?.partner_id) {
        const { data: p } = await supabase.from("partners").select("id, name").eq("id", d.partner_id).single();
        if (p) setPartner(p);
      }
    }
    if (data.lead_id) {
      const { data: l } = await supabase.from("leads").select("id, business_name, contact_name, email, phone, monthly_volume").eq("id", data.lead_id).single();
      if (l) setLead(l);
      const { data: ow } = await supabase.from("deal_owners").select("id, full_name, title, ownership_pct, ssn_encrypted").eq("lead_id", data.lead_id).order("created_at");
      if (ow) setOwners(ow);
    }

    setState("signing");
  };

  // ── Canvas drawing helpers ──────────────────────────────────────────────
  const getCanvasCtx = () => canvasRef.current?.getContext("2d") || null;

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getCanvasCtx();
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getCanvasCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCanvasCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const getSignatureData = (): string | null => {
    if (sigMode === "type") {
      if (!typedSig.trim()) return null;
      // Render typed text to a canvas and export as base64
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = 400;
      tmpCanvas.height = 100;
      const ctx = tmpCanvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 100);
      ctx.font = "italic 36px Georgia, serif";
      ctx.fillStyle = "#1e293b";
      ctx.textBaseline = "middle";
      ctx.fillText(typedSig, 20, 50);
      return tmpCanvas.toDataURL("image/png");
    } else {
      if (!hasDrawn || !canvasRef.current) return null;
      return canvasRef.current.toDataURL("image/png");
    }
  };

  const hasSig = sigMode === "type" ? !!typedSig.trim() : hasDrawn;

  const handleSubmit = async () => {
    const sigData = getSignatureData();
    if (!sigData || !consent) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signature_data: sigData, consent: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Failed to submit signature");
        setSubmitting(false);
        return;
      }
      setState("success");
    } catch {
      setSubmitError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  // ── Format helpers ──────────────────────────────────────────────────────
  const fmt = (n: number | null) => n != null ? `$${Number(n).toLocaleString()}` : "—";
  const maskSsn = (encrypted: string | null) => encrypted ? "***-**-" + (encrypted.slice(-4) || "****") : "—";

  // ── Render ──────────────────────────────────────────────────────────────
  const Logo = () => (
    <div className="flex items-center gap-2">
      <img src="/splits-icon.svg" alt="Splits" className="w-8 h-8" />
      <span className="text-xl font-bold text-slate-900">Splits</span>
    </div>
  );

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading application...</p>
        </div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <Logo />
          <p className="text-4xl mt-6 mb-4">🔗</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h1>
          <p className="text-slate-500">This signing link is invalid. Please check the URL or contact your agent for a new link.</p>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <Logo />
          <p className="text-4xl mt-6 mb-4">⏰</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h1>
          <p className="text-slate-500">This signing link has expired. Please contact your agent for a new link.</p>
        </div>
      </div>
    );
  }

  if (state === "signed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <Logo />
          <p className="text-4xl mt-6 mb-4">✅</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Already Signed</h1>
          <p className="text-slate-500">This application was signed on {session?.signed_at ? new Date(session.signed_at).toLocaleDateString() : "a previous date"}.</p>
          <p className="text-sm text-slate-400 mt-2">Thank you! Your agent will be in touch with next steps.</p>
        </div>
      </div>
    );
  }

  if (state === "revoked") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <Logo />
          <p className="text-4xl mt-6 mb-4">🚫</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link Revoked</h1>
          <p className="text-slate-500">This signing link has been revoked. Please contact your agent for a new link.</p>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <Logo />
          <p className="text-4xl mt-6 mb-4">🎉</p>
          <h1 className="text-xl font-bold text-emerald-600 mb-2">Application Signed!</h1>
          <p className="text-slate-500">Thank you! Your application has been signed and submitted. Your agent will be in touch with next steps.</p>
        </div>
      </div>
    );
  }

  // ── Signing state ──────────────────────────────────────────────────────
  const sectionClass = "bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-4";
  const labelClass = "text-xs text-slate-500 block mb-0.5";
  const valueClass = "text-sm text-slate-900";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <span className="text-xs text-slate-400">Secure Signing</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Merchant Application</h1>
        <p className="text-sm text-slate-500 mb-6">Review the details below and sign to submit your application.</p>

        {/* Section 1: Application Summary */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-slate-900 mb-4">Application Summary</h2>

          {/* Business Info */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Business Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <div><span className={labelClass}>Business Name</span><p className={valueClass}>{deal?.business_legal_name || lead?.business_name || "—"}</p></div>
              <div><span className={labelClass}>DBA</span><p className={valueClass}>{deal?.dba_name || "—"}</p></div>
              <div className="sm:col-span-2"><span className={labelClass}>Address</span><p className={valueClass}>{[deal?.legal_street, deal?.legal_city, deal?.legal_state, deal?.legal_zip].filter(Boolean).join(", ") || "—"}</p></div>
              <div><span className={labelClass}>Entity Type</span><p className={valueClass}>{deal?.entity_type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—"}</p></div>
              <div><span className={labelClass}>EIN/ITIN</span><p className={valueClass}>{deal?.ein_itin || "—"}</p></div>
            </div>
          </div>

          {/* Owner Info */}
          {owners.length > 0 && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ownership</h3>
              {owners.map((o, i) => (
                <div key={o.id} className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mb-2">
                  <div><span className={labelClass}>Name</span><p className={valueClass}>{o.full_name || "—"}</p></div>
                  <div><span className={labelClass}>Title</span><p className={valueClass}>{o.title || "—"}</p></div>
                  <div><span className={labelClass}>Ownership</span><p className={valueClass}>{o.ownership_pct ? `${o.ownership_pct}%` : "—"}</p></div>
                  <div><span className={labelClass}>SSN</span><p className={valueClass}>{maskSsn(o.ssn_encrypted)}</p></div>
                </div>
              ))}
            </div>
          )}

          {/* Processing Info */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Processing</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
              <div><span className={labelClass}>Monthly Volume</span><p className={valueClass}>{fmt(deal?.monthly_volume || lead?.monthly_volume)}</p></div>
              <div><span className={labelClass}>Avg Ticket</span><p className={valueClass}>{fmt(deal?.average_ticket)}</p></div>
              <div><span className={labelClass}>Card Present</span><p className={valueClass}>{deal?.cp_pct ? `${deal.cp_pct}%` : "—"}</p></div>
              <div><span className={labelClass}>Card Not Present</span><p className={valueClass}>{deal?.cnp_pct ? `${deal.cnp_pct}%` : "—"}</p></div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pricing</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              <div><span className={labelClass}>Type</span><p className={valueClass}>{deal?.pricing_type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—"}</p></div>
              {deal?.pricing_type === "interchange_plus" && (
                <>
                  <div><span className={labelClass}>Visa Rate</span><p className={valueClass}>{deal.ic_plus_visa_pct ? `${deal.ic_plus_visa_pct}% + $${deal.ic_plus_visa_txn || "0"}` : "—"}</p></div>
                  <div><span className={labelClass}>MC Rate</span><p className={valueClass}>{deal.ic_plus_mc_pct ? `${deal.ic_plus_mc_pct}% + $${deal.ic_plus_mc_txn || "0"}` : "—"}</p></div>
                </>
              )}
              {deal?.pricing_type === "dual_pricing" && (
                <div><span className={labelClass}>Rate</span><p className={valueClass}>{deal.dual_pricing_rate ? `${deal.dual_pricing_rate}%` : "—"}</p></div>
              )}
              {deal?.pricing_type === "flat_rate" && (
                <div><span className={labelClass}>Rate</span><p className={valueClass}>{deal.flat_rate_pct ? `${deal.flat_rate_pct}%` : "—"}</p></div>
              )}
            </div>
          </div>

          {/* Equipment */}
          {(deal?.hardware_items || []).length > 0 && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Equipment</h3>
              {deal.hardware_items.map((hw: any, i: number) => (
                <p key={i} className="text-sm text-slate-700">{hw.quantity}x {hw.model || hw.type || "Hardware"}{hw.free === "yes" ? " (Free placement)" : hw.cost ? ` ($${hw.cost})` : ""}</p>
              ))}
            </div>
          )}

          {/* Partner & Bank */}
          {(partner || deal?.sponsor_bank) && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Processing Partner</h3>
              <div className="grid grid-cols-2 gap-x-4">
                {partner && <div><span className={labelClass}>Partner</span><p className={valueClass}>{partner.name}</p></div>}
                {deal?.sponsor_bank && <div><span className={labelClass}>Sponsor Bank</span><p className={valueClass}>{deal.sponsor_bank}</p></div>}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Terms & Consent */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Terms & Consent</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-sm text-slate-600 leading-relaxed">
              I agree to conduct this transaction electronically and understand this constitutes a legally binding signature under the ESIGN Act.
            </span>
          </label>
        </div>

        {/* Section 3: Signature */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Signature</h2>

          {/* Tab toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 mb-4">
            <button
              onClick={() => setSigMode("type")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${sigMode === "type" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Type Signature
            </button>
            <button
              onClick={() => setSigMode("draw")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${sigMode === "draw" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Draw Signature
            </button>
          </div>

          {sigMode === "type" ? (
            <div>
              <input
                type="text"
                value={typedSig}
                onChange={(e) => setTypedSig(e.target.value)}
                placeholder="Type your full name"
                className="w-full px-4 py-3 text-lg border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              {typedSig && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400 mb-1">Preview</p>
                  <p className="text-3xl text-slate-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}>{typedSig}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white touch-none">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full cursor-crosshair"
                  style={{ height: "150px" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-slate-400">Sign above with your mouse or finger</p>
                <button onClick={clearCanvas} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Submit */}
        <div className="mb-8">
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-3">{submitError}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!consent || !hasSig || submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl text-base font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Sign & Submit Application"}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">By clicking above, you confirm the information is accurate and agree to the terms.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-slate-400">Powered by Splits &middot; Secure electronic signature</p>
        </div>
      </div>
    </div>
  );
}
