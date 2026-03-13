"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import PricingPreview from '@/components/PricingPreview';
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";

export default function PartnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { member, loading: authLoading } = useAuth();
  const role = member?.role || "";
  const isOwnerOrManager = role === "owner" || role === "manager";
  const [partner, setPartner] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [hardware, setHardware] = useState<any[]>([]);
  const [software, setSoftware] = useState<any[]>([]);
  const [underwriting, setUnderwriting] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [partnerMerchants, setPartnerMerchants] = useState<any[]>([]);
  const [merchantResiduals, setMerchantResiduals] = useState<Record<string, { ytd: number; lastMonth: number }>>({});
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [merchantsFetched, setMerchantsFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState("banks");

  const tabs = [
    { key: "banks", label: "Sponsor Banks" },
    { key: "hardware", label: "Hardware" },
    { key: "software", label: "Software" },
    { key: "underwriting", label: "Underwriting" },
    { key: "pricing", label: "Pricing" },
    { key: "merchants", label: "Merchants" },
  ];

  useEffect(() => {
    if (authLoading) return;
    if (!isOwnerOrManager) { router.push("/dashboard"); return; }
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("partners").select("*").eq("id", params.id).single();
      if (p) {
        setPartner(p);
        const { data: b } = await supabase.from("partner_sponsor_banks").select("*").eq("partner_id", p.id).order("created_at");
        if (b) {
          setBanks(b);
          fetchMpasForBanks(b.map((bank: any) => bank.id));
        }
        const { data: h } = await supabase.from("partner_hardware").select("*").eq("partner_id", p.id).order("created_at");
        if (h) setHardware(h);
        const { data: s } = await supabase.from("partner_software").select("*").eq("partner_id", p.id).order("created_at");
        if (s) setSoftware(s);
        const { data: u } = await supabase.from("partner_underwriting").select("*").eq("partner_id", p.id).order("created_at");
        if (u) setUnderwriting(u);
        const { data: pr } = await supabase.from("partner_pricing").select("*").eq("partner_id", p.id).order("created_at");
        if (pr) setPricing(pr);
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 2000); };
  const updatePartnerField = (field: string, value: any) => { setPartner({ ...partner, [field]: value }); };

  const savePartner = async () => {
    setSaving(true);
    const { id, created_at, ...updates } = partner;
    await supabase.from("partners").update(updates).eq("id", partner.id);
    showMsg("Partner saved!");
    setSaving(false);
  };

  const addBank = async () => { const { data } = await supabase.from("partner_sponsor_banks").insert({ partner_id: partner.id, bank_name: "" }).select().single(); if (data) setBanks([...banks, data]); };
  const updateBank = (idx: number, field: string, value: any) => { const u = [...banks]; u[idx] = { ...u[idx], [field]: value }; setBanks(u); };
  const saveBank = async (idx: number) => { const b = banks[idx]; const { id, created_at, ...updates } = b; await supabase.from("partner_sponsor_banks").update(updates).eq("id", b.id); showMsg("Bank saved!"); };
  const removeBank = async (idx: number) => { await supabase.from("partner_sponsor_banks").delete().eq("id", banks[idx].id); setBanks(banks.filter((_, i) => i !== idx)); };

  const addHardware = async () => { const { data } = await supabase.from("partner_hardware").insert({ partner_id: partner.id, hardware_name: "" }).select().single(); if (data) setHardware([...hardware, data]); };
  const updateHw = (idx: number, field: string, value: any) => { const u = [...hardware]; u[idx] = { ...u[idx], [field]: value }; setHardware(u); };
  const saveHw = async (idx: number) => { const h = hardware[idx]; const { id, created_at, ...updates } = h; await supabase.from("partner_hardware").update(updates).eq("id", h.id); showMsg("Hardware saved!"); };
  const removeHw = async (idx: number) => { await supabase.from("partner_hardware").delete().eq("id", hardware[idx].id); setHardware(hardware.filter((_, i) => i !== idx)); };

  const addSoftware = async () => { const { data } = await supabase.from("partner_software").insert({ partner_id: partner.id, software_name: "" }).select().single(); if (data) setSoftware([...software, data]); };
  const updateSw = (idx: number, field: string, value: any) => { const u = [...software]; u[idx] = { ...u[idx], [field]: value }; setSoftware(u); };
  const saveSw = async (idx: number) => { const s = software[idx]; const { id, created_at, ...updates } = s; await supabase.from("partner_software").update(updates).eq("id", s.id); showMsg("Software saved!"); };
  const removeSw = async (idx: number) => { await supabase.from("partner_software").delete().eq("id", software[idx].id); setSoftware(software.filter((_, i) => i !== idx)); };

  const addUw = async () => { const { data } = await supabase.from("partner_underwriting").insert({ partner_id: partner.id, guideline_name: "" }).select().single(); if (data) setUnderwriting([...underwriting, data]); };
  const updateUw = (idx: number, field: string, value: any) => { const u = [...underwriting]; u[idx] = { ...u[idx], [field]: value }; setUnderwriting(u); };
  const saveUw = async (idx: number) => { const uw = underwriting[idx]; const { id, created_at, ...updates } = uw; await supabase.from("partner_underwriting").update(updates).eq("id", uw.id); showMsg("Guideline saved!"); };
  const removeUw = async (idx: number) => { await supabase.from("partner_underwriting").delete().eq("id", underwriting[idx].id); setUnderwriting(underwriting.filter((_, i) => i !== idx)); };

  const addPr = async () => { const { data } = await supabase.from("partner_pricing").insert({ partner_id: partner.id, schedule_name: "" }).select().single(); if (data) setPricing([...pricing, data]); };
  const updatePr = (idx: number, field: string, value: any) => { const u = [...pricing]; u[idx] = { ...u[idx], [field]: value }; setPricing(u); };
  const savePr = async (idx: number) => { const pr = pricing[idx]; const { id, created_at, ...updates } = pr; await supabase.from("partner_pricing").update(updates).eq("id", pr.id); showMsg("Pricing saved!"); };
  const removePr = async (idx: number) => { await supabase.from("partner_pricing").delete().eq("id", pricing[idx].id); setPricing(pricing.filter((_, i) => i !== idx)); };

  // MPA documents state
  const [bankMpas, setBankMpas] = useState<Record<string, any[]>>({});
  const [mpaUploading, setMpaUploading] = useState<Record<string, boolean>>({});

  const fetchMpasForBanks = async (bankIds: string[]) => {
    if (bankIds.length === 0) return;
    const { data } = await supabase
      .from("sponsor_bank_mpas")
      .select("*")
      .in("sponsor_bank_id", bankIds)
      .order("created_at", { ascending: false });
    const grouped: Record<string, any[]> = {};
    for (const mpa of data || []) {
      if (!grouped[mpa.sponsor_bank_id]) grouped[mpa.sponsor_bank_id] = [];
      grouped[mpa.sponsor_bank_id].push(mpa);
    }
    setBankMpas(grouped);
  };

  const fetchMpasForBank = async (bankId: string) => {
    const { data } = await supabase
      .from("sponsor_bank_mpas")
      .select("*")
      .eq("sponsor_bank_id", bankId)
      .order("created_at", { ascending: false });
    setBankMpas(prev => ({ ...prev, [bankId]: data || [] }));
  };

  const uploadMpa = async (bankId: string, file: File) => {
    setMpaUploading(prev => ({ ...prev, [bankId]: true }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMpaUploading(prev => ({ ...prev, [bankId]: false })); return; }

    const timestamp = Date.now();
    const path = `${user.id}/${partner.id}/mpas/${bankId}/${timestamp}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("deal-documents")
      .upload(path, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setMpaUploading(prev => ({ ...prev, [bankId]: false }));
      return;
    }

    const { data: urlData } = supabase.storage.from("deal-documents").getPublicUrl(path);

    await supabase.from("sponsor_bank_mpas").insert({
      sponsor_bank_id: bankId,
      user_id: user.id,
      file_name: file.name,
      file_url: urlData.publicUrl,
      storage_path: path,
    });

    await fetchMpasForBank(bankId);
    setMpaUploading(prev => ({ ...prev, [bankId]: false }));
  };

  const deleteMpa = async (mpa: any) => {
    if (mpa.storage_path) {
      await supabase.storage.from("deal-documents").remove([mpa.storage_path]);
    }
    await supabase.from("sponsor_bank_mpas").delete().eq("id", mpa.id);
    await fetchMpasForBank(mpa.sponsor_bank_id);
  };

  const [distinctMonthCount, setDistinctMonthCount] = useState(0);

  const fetchMerchants = async () => {
    if (merchantsFetched || !partner) return;
    setMerchantsLoading(true);
    const { data: allMerchants } = await supabase
      .from("merchants")
      .select("id, business_name, mid, status, monthly_volume, processor")
      .eq("user_id", partner.user_id);

    const matched = (allMerchants || []).filter((m: any) =>
      m.processor && partner.name && m.processor.toLowerCase().includes(partner.name.toLowerCase())
    );
    setPartnerMerchants(matched);

    if (matched.length > 0) {
      const merchantIds = matched.map((m: any) => m.id);
      const currentYear = new Date().getFullYear().toString();
      const { data: residuals } = await supabase
        .from("residual_records")
        .select("merchant_id, report_month, gross_income, total_expenses")
        .in("merchant_id", merchantIds);

      const resMap: Record<string, { ytd: number; lastMonth: number }> = {};
      const allMonths = new Set<string>();
      let latestMonth = "";
      for (const r of residuals || []) {
        if (r.report_month && r.report_month > latestMonth) latestMonth = r.report_month;
      }
      for (const r of residuals || []) {
        if (!r.merchant_id) continue;
        if (!resMap[r.merchant_id]) resMap[r.merchant_id] = { ytd: 0, lastMonth: 0 };
        const net = (r.gross_income || 0) - (r.total_expenses || 0);
        if (r.report_month && r.report_month.startsWith(currentYear)) {
          resMap[r.merchant_id].ytd += net;
          allMonths.add(r.report_month);
        }
        if (r.report_month && r.report_month === latestMonth) {
          resMap[r.merchant_id].lastMonth += net;
        }
      }
      setMerchantResiduals(resMap);
      setDistinctMonthCount(allMonths.size);
    }

    setMerchantsLoading(false);
    setMerchantsFetched(true);
  };

  const inputClass = "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-base";
  const labelClass = "text-base text-slate-500 block mb-1";
  const cardClass = "bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-4";

  if (loading) return <LoadingScreen />;
  if (!partner) return <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8">Partner not found</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <Link href="/dashboard/partners" className="text-slate-400 hover:text-slate-900 text-sm transition">← Back to Partners</Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">{partner.name}</h2>
            <p className="text-slate-500 mt-1">{partner.relationship_manager || "No relationship manager set"}</p>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-emerald-600 text-sm">{msg}</span>}
            <select value={partner.status || "active"} onChange={(e) => updatePartnerField("status", e.target.value)} className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer text-slate-900">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="font-semibold mb-4 text-emerald-600">Partner Info</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div><label className={labelClass}>Partner Name</label><input type="text" value={partner.name || ""} onChange={(e) => updatePartnerField("name", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Relationship Manager</label><input type="text" value={partner.relationship_manager || ""} onChange={(e) => updatePartnerField("relationship_manager", e.target.value)} className={inputClass} /></div>
            <div>
              <label className={labelClass}>
                {partner.support_phone ? <a href={`tel:${partner.support_phone}`} className="text-emerald-600 hover:text-emerald-700">Support Phone</a> : "Support Phone"}
              </label>
              <input type="text" value={partner.support_phone || ""} onChange={(e) => updatePartnerField("support_phone", e.target.value)} className={inputClass} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className={labelClass}>
                {partner.rm_phone ? <a href={`tel:${partner.rm_phone}`} className="text-emerald-600 hover:text-emerald-700">RM Phone</a> : "RM Phone"}
              </label>
              <input type="text" value={partner.rm_phone || ""} onChange={(e) => updatePartnerField("rm_phone", e.target.value)} className={inputClass} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelClass}>
                {partner.email ? <a href={`mailto:${partner.email}`} className="text-emerald-600 hover:text-emerald-700">Email</a> : "Email"}
              </label>
              <input type="email" value={partner.email || ""} onChange={(e) => updatePartnerField("email", e.target.value)} className={inputClass} placeholder="rep@partner.com" />
            </div>
            <div>
              <label className={labelClass}>
                {partner.website ? <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">Website</a> : "Website"}
              </label>
              <input type="text" value={partner.website || ""} onChange={(e) => updatePartnerField("website", e.target.value)} className={inputClass} placeholder="https://partner.com" />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Notes</label>
            <textarea value={partner.notes || ""} onChange={(e) => updatePartnerField("notes", e.target.value)} className={inputClass + " h-20 resize-none"} />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={savePartner} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Saving..." : "Save Partner Info"}</button>
          </div>
        </div>

        <div className="flex flex-nowrap gap-2 mb-6 border-b border-slate-200 pb-2 overflow-x-auto">
          {tabs.map((t) => {
            const count = t.key === "banks" ? banks.length : t.key === "hardware" ? hardware.length : t.key === "software" ? software.length : t.key === "underwriting" ? underwriting.length : t.key === "merchants" ? partnerMerchants.length : pricing.length;
            return (
              <button key={t.key} onClick={() => { setActiveTab(t.key); if (t.key === "merchants") fetchMerchants(); }} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap ${activeTab === t.key ? "bg-white text-slate-900 border-b-2 border-emerald-500" : "text-slate-400 hover:text-slate-900"}`}>
                {t.label} ({count})
              </button>
            );
          })}
        </div>

        {activeTab === "banks" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Sponsor Banks</h4>
              <button onClick={addBank} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Bank</button>
            </div>
            {banks.length === 0 && <p className="text-slate-500 text-sm">No sponsor banks added yet.</p>}
            {banks.map((b, idx) => (
              <div key={b.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Bank {idx + 1}</span>
                  <div className="flex gap-3">
                    <button onClick={() => saveBank(idx)} className="text-emerald-600 hover:text-emerald-700 text-xs">Save</button>
                    <button onClick={() => removeBank(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                {/* ROW 1: Bank Name + Cutoff Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div><label className={labelClass}>Bank Name</label><input type="text" value={b.bank_name || ""} onChange={(e) => updateBank(idx, "bank_name", e.target.value)} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Cutoff Timezone</label>
                    <select value={b.cutoff_timezone || "ET"} onChange={(e) => updateBank(idx, "cutoff_timezone", e.target.value)} className={inputClass}>
                      <option value="ET">Eastern (ET)</option>
                      <option value="CT">Central (CT)</option>
                      <option value="MT">Mountain (MT)</option>
                      <option value="PT">Pacific (PT)</option>
                    </select>
                  </div>
                </div>
                {/* ROW 2: Next Day Funding + Same Day Funding */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={!!b.next_day_funding} onChange={(e) => updateBank(idx, "next_day_funding", e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm font-medium text-slate-700">Next Day Funding</span>
                    </label>
                    {b.next_day_funding && (
                      <div className="ml-7">
                        <label className={labelClass}>Batch Cutoff</label>
                        <input type="time" value={b.batch_cutoff_time || ""} onChange={(e) => updateBank(idx, "batch_cutoff_time", e.target.value)} className={`${inputClass} w-36`} />
                        <p className="text-xs text-slate-400 mt-0.5">{b.cutoff_timezone || "ET"}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={!!b.same_day_funding} onChange={(e) => updateBank(idx, "same_day_funding", e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm font-medium text-slate-700">Same Day Funding</span>
                    </label>
                    {b.same_day_funding && (
                      <div className="ml-7">
                        <label className={labelClass}>Same Day Cutoff</label>
                        <input type="time" value={b.same_day_cutoff_time || ""} onChange={(e) => updateBank(idx, "same_day_cutoff_time", e.target.value)} className={`${inputClass} w-36`} />
                        <p className="text-xs text-slate-400 mt-0.5">{b.cutoff_timezone || "ET"}</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* ROW 3: MCC Codes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Accepted MCC Codes</label><input type="text" value={b.accepted_mcc_codes || ""} onChange={(e) => updateBank(idx, "accepted_mcc_codes", e.target.value)} className={inputClass} placeholder="e.g. 5411, 5812" /></div>
                  <div><label className={labelClass}>Restricted MCC Codes</label><input type="text" value={b.restricted_mcc_codes || ""} onChange={(e) => updateBank(idx, "restricted_mcc_codes", e.target.value)} className={inputClass} placeholder="e.g. 7995, 5967" /></div>
                </div>
                {/* MPA Documents */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                  <span className="text-sm font-semibold text-slate-700">MPA Templates</span>
                  <label className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition">
                    {mpaUploading[b.id] ? "Uploading..." : "📄 Upload MPA"}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      disabled={!!mpaUploading[b.id]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadMpa(b.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {(bankMpas[b.id] || []).length === 0 ? (
                  <p className="text-xs text-slate-400 mt-2">No MPA templates uploaded</p>
                ) : (
                  <div className="mt-2">
                    {(bankMpas[b.id] || []).map((mpa: any) => (
                      <div key={mpa.id} className="flex items-center justify-between py-2">
                        <a href={mpa.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 truncate">
                          📄 {mpa.file_name}
                        </a>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-xs text-slate-400">
                            {new Date(mpa.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <button onClick={() => deleteMpa(mpa)} className="text-red-400 hover:text-red-500 text-xs">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "hardware" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Hardware Options</h4>
              <button onClick={addHardware} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Hardware</button>
            </div>
            {hardware.length === 0 && <p className="text-slate-500 text-sm">No hardware options added yet.</p>}
            {hardware.map((h, idx) => (
              <div key={h.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Hardware {idx + 1}</span>
                  <div className="flex gap-3">
                    <button onClick={() => saveHw(idx)} className="text-emerald-600 hover:text-emerald-700 text-xs">Save</button>
                    <button onClick={() => removeHw(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Hardware Type</label><select value={h.hardware_type || ""} onChange={(e) => updateHw(idx, "hardware_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="terminal">Terminal</option><option value="mobile_reader">Mobile Reader</option><option value="pos">POS</option></select></div>
                  <div><label className={labelClass}>Hardware Name</label><input type="text" value={h.hardware_name || ""} onChange={(e) => updateHw(idx, "hardware_name", e.target.value)} className={inputClass} placeholder="e.g. Dejavoo QD4" /></div>
                  <div><label className={labelClass}>Model</label><input type="text" value={h.model || ""} onChange={(e) => updateHw(idx, "model", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Cost ($)</label><input type="number" step="0.01" value={h.cost || ""} onChange={(e) => updateHw(idx, "cost", e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "software" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Software Options</h4>
              <button onClick={addSoftware} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Software</button>
            </div>
            {software.length === 0 && <p className="text-slate-500 text-sm">No software options added yet.</p>}
            {software.map((s, idx) => (
              <div key={s.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Software {idx + 1}</span>
                  <div className="flex gap-3">
                    <button onClick={() => saveSw(idx)} className="text-emerald-600 hover:text-emerald-700 text-xs">Save</button>
                    <button onClick={() => removeSw(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Software Name</label><input type="text" value={s.software_name || ""} onChange={(e) => updateSw(idx, "software_name", e.target.value)} className={inputClass} placeholder="e.g. Authorize.net" /></div>
                  <div><label className={labelClass}>Type</label><select value={s.software_type || ""} onChange={(e) => updateSw(idx, "software_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="gateway">Gateway</option><option value="pos">POS</option><option value="plugin">Plugin</option></select></div>
                  <div><label className={labelClass}>Monthly Cost ($)</label><input type="number" step="0.01" value={s.monthly_cost || ""} onChange={(e) => updateSw(idx, "monthly_cost", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Per Transaction ($)</label><input type="number" step="0.01" value={s.per_transaction_cost || ""} onChange={(e) => updateSw(idx, "per_transaction_cost", e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "underwriting" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Underwriting Guidelines</h4>
              <button onClick={addUw} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Guideline</button>
            </div>
            {underwriting.length === 0 && <p className="text-slate-500 text-sm">No underwriting guidelines added yet.</p>}
            {underwriting.map((u, idx) => (
              <div key={u.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Guideline {idx + 1}</span>
                  <div className="flex gap-3">
                    <button onClick={() => saveUw(idx)} className="text-emerald-600 hover:text-emerald-700 text-xs">Save</button>
                    <button onClick={() => removeUw(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div><label className={labelClass}>Guideline Name</label><input type="text" value={u.guideline_name || ""} onChange={(e) => updateUw(idx, "guideline_name", e.target.value)} className={inputClass} placeholder="e.g. Standard Approval" /></div>
                  <div><label className={labelClass}>Description</label><input type="text" value={u.description || ""} onChange={(e) => updateUw(idx, "description", e.target.value)} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className={labelClass}>Max Volume ($)</label><input type="number" step="0.01" value={u.max_volume || ""} onChange={(e) => updateUw(idx, "max_volume", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Max Ticket ($)</label><input type="number" step="0.01" value={u.max_ticket || ""} onChange={(e) => updateUw(idx, "max_ticket", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Restricted Industries</label><input type="text" value={u.restricted_industries || ""} onChange={(e) => updateUw(idx, "restricted_industries", e.target.value)} className={inputClass} placeholder="e.g. Cannabis, Firearms" /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "merchants" && (
          <div>
            {merchantsLoading ? (
              <p className="text-sm text-slate-500">Loading merchants...</p>
            ) : partnerMerchants.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No merchants associated with this partner yet.</p>
            ) : (() => {
              const totalYtd = partnerMerchants.reduce((sum, m) => sum + (merchantResiduals[m.id]?.ytd || 0), 0);
              const avgMonthly = distinctMonthCount > 0 ? totalYtd / distinctMonthCount : 0;
              const sorted = [...partnerMerchants].sort((a, b) => (merchantResiduals[b.id]?.ytd || 0) - (merchantResiduals[a.id]?.ytd || 0));
              const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-xs text-slate-500 mb-1">Total Merchants</p>
                      <p className="text-2xl font-bold text-slate-900">{partnerMerchants.length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-xs text-slate-500 mb-1">Total Residuals (YTD)</p>
                      <p className={`text-2xl font-bold ${totalYtd >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(totalYtd)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-xs text-slate-500 mb-1">Avg Monthly Residual</p>
                      <p className={`text-2xl font-bold ${avgMonthly >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(avgMonthly)}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Business Name</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">MID</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Monthly Volume</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Last Month Residual</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">YTD Residual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((m) => {
                          const res = merchantResiduals[m.id];
                          const statusColors: Record<string, string> = {
                            active: "bg-emerald-50 text-emerald-700",
                            pending: "bg-amber-50 text-amber-700",
                            inactive: "bg-red-50 text-red-700",
                          };
                          return (
                            <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <Link href={`/dashboard/merchants/${m.id}`} className="text-emerald-600 hover:text-emerald-700 font-medium">
                                  {m.business_name}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600 font-mono text-xs">{m.mid || "—"}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[m.status] || "bg-slate-100 text-slate-600"}`}>
                                  {m.status || "unknown"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                                {m.monthly_volume ? fmt(Number(m.monthly_volume)) : "—"}
                              </td>
                              <td className={`px-4 py-3 text-right tabular-nums ${(res?.lastMonth || 0) >= 0 ? "text-slate-700" : "text-red-600"}`}>
                                {res?.lastMonth != null ? fmt(res.lastMonth) : "—"}
                              </td>
                              <td className={`px-4 py-3 text-right tabular-nums font-medium ${(res?.ytd || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {res?.ytd != null ? fmt(res.ytd) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === "pricing" && (
          <div>
            {partner.pricing_data && (
              <div className="mb-6">
                <h4 className="font-semibold text-emerald-600 mb-4">Extracted Pricing Schedule</h4>
                <PricingPreview
                  pricing={partner.pricing_data}
                  onRemove={async (index) => {
                    const existing = Array.isArray(partner.pricing_data) ? partner.pricing_data : partner.pricing_data ? [partner.pricing_data] : [];
                    const updated = existing.filter((_: any, i: number) => i !== index);
                    const newData = updated.length > 0 ? updated : null;
                    await supabase.from('partners').update({ pricing_data: newData }).eq('id', partner.id);
                    setPartner({ ...partner, pricing_data: newData });
                    showMsg('Schedule removed');
                  }}
                />
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Pricing Schedules</h4>
              <button onClick={addPr} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Schedule</button>
            </div>
            {pricing.length === 0 && <p className="text-slate-500 text-sm">No pricing schedules added yet.</p>}
            {pricing.map((p, idx) => (
              <div key={p.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Schedule {idx + 1}</span>
                  <div className="flex gap-3">
                    <button onClick={() => savePr(idx)} className="text-emerald-600 hover:text-emerald-700 text-xs">Save</button>
                    <button onClick={() => removePr(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div><label className={labelClass}>Schedule Name</label><input type="text" value={p.schedule_name || ""} onChange={(e) => updatePr(idx, "schedule_name", e.target.value)} className={inputClass} placeholder="e.g. Standard IC+" /></div>
                  <div><label className={labelClass}>Pricing Model</label><select value={p.pricing_model || ""} onChange={(e) => updatePr(idx, "pricing_model", e.target.value)} className={inputClass}><option value="">Select...</option><option value="interchange_plus">Interchange Plus</option><option value="dual_pricing">Dual Pricing</option><option value="surcharging">Surcharging</option><option value="tiered">Tiered</option><option value="flat_rate">Flat Rate</option></select></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className={labelClass}>Discount Rate (%)</label><input type="number" step="0.01" value={p.discount_rate || ""} onChange={(e) => updatePr(idx, "discount_rate", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Per Transaction Fee ($)</label><input type="number" step="0.01" value={p.per_transaction_fee || ""} onChange={(e) => updatePr(idx, "per_transaction_fee", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Monthly Fee ($)</label><input type="number" step="0.01" value={p.monthly_fee || ""} onChange={(e) => updatePr(idx, "monthly_fee", e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
