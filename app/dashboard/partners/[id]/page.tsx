"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import PricingPreview from '@/components/PricingPreview';
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";
import { authFetch } from "@/lib/api-client";
import { getSignedUrl } from "@/lib/storage";
import ExportCSV from "@/components/ExportCSV";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  // Rep codes
  const [partnerRepCodes, setPartnerRepCodes] = useState<any[]>([]);
  const [repCodesFetched, setRepCodesFetched] = useState(false);
  const [repProfiles, setRepProfiles] = useState<Record<string, string>>({});
  const [showRepModal, setShowRepModal] = useState(false);
  const [repForm, setRepForm] = useState({ user_id: '', rep_code: '', label: '', split_pct: '', bonus_per_deal: '', house_split_override_pct: '', restricted_split_pct: '', payout_type: 'agent_paid', code_type: 'standard', effective_date: '', notes: '' });
  const [repSaving, setRepSaving] = useState(false);
  const [repError, setRepError] = useState('');
  const [repAgents, setRepAgents] = useState<any[]>([]);
  const [orgDefaultHouseSplit, setOrgDefaultHouseSplit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState("banks");
  const [hwExtracting, setHwExtracting] = useState(false);
  const [hwPreview, setHwPreview] = useState<any[] | null>(null);
  const [hwSelected, setHwSelected] = useState<Set<number>>(new Set());
  const [swExtracting, setSwExtracting] = useState(false);
  const [swPreview, setSwPreview] = useState<any[] | null>(null);
  const [swSelected, setSwSelected] = useState<Set<number>>(new Set());
  const [agreements, setAgreements] = useState<any[]>([]);
  const [agreementsFetched, setAgreementsFetched] = useState(false);
  const [agreementUploading, setAgreementUploading] = useState(false);
  const [agreementPending, setAgreementPending] = useState<{ file_name: string; file_url: string } | null>(null);
  const [agreementForm, setAgreementForm] = useState({ agreement_type: "", description: "" });
  // Residuals tab state
  const [resImports, setResImports] = useState<any[]>([]);
  const [resRecords, setResRecords] = useState<Record<string, any[]>>({});
  const [resExpandedId, setResExpandedId] = useState<string | null>(null);
  const [resFetched, setResFetched] = useState(false);
  const [resTrending, setResTrending] = useState<{ month: string; net: number }[]>([]);

  const tabs = [
    { key: "banks", label: "Merchant Applications" },
    { key: "hardware", label: "Hardware" },
    { key: "software", label: "Software" },
    { key: "underwriting", label: "Underwriting" },
    { key: "pricing", label: "Pricing" },
    { key: "merchants", label: "Merchants" },
    { key: "agreements", label: "Agreements" },
    { key: "repcodes", label: "Rep Codes" },
    { key: "residuals", label: "Residuals" },
  ];

  useEffect(() => {
    if (authLoading) return;
    if (!isOwnerOrManager) { router.push("/dashboard"); return; }
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("partners").select("id, created_at, name, relationship_manager, status, support_phone, rm_phone, email, website, residual_split, restricted_split_pct, notes, pricing_data, department_contacts, user_id").eq("id", params.id).single();
      if (p) {
        setPartner(p);
        const { data: b } = await supabase.from("partner_sponsor_banks").select("id, created_at, partner_id, bank_name, cutoff_timezone, next_day_funding, batch_cutoff_time, same_day_funding, same_day_cutoff_time, accepted_mcc_codes, restricted_mcc_codes, details").eq("partner_id", p.id).order("created_at");
        if (b) {
          setBanks(b);
          fetchMpasForBanks(b);
        }
        const { data: h } = await supabase.from("partner_hardware").select("id, created_at, partner_id, hardware_type, hardware_name, manufacturer, model, cost, msrp, partner_cost, free_placement_eligible, details, notes").eq("partner_id", p.id).order("created_at");
        if (h) setHardware(h);
        const { data: s } = await supabase.from("partner_software").select("id, created_at, partner_id, software_name, software_type, manufacturer, monthly_cost, per_transaction_cost, per_txn_cost, msrp, partner_cost, details, notes").eq("partner_id", p.id).order("created_at");
        if (s) setSoftware(s);
        const { data: u } = await supabase.from("partner_underwriting").select("id, created_at, partner_id, guideline_name, description, max_volume, max_ticket, restricted_industries, details").eq("partner_id", p.id).order("created_at");
        if (u) setUnderwriting(u);
        const { data: pr } = await supabase.from("partner_pricing").select("id, created_at, partner_id, schedule_name, pricing_model, discount_rate, per_transaction_fee, monthly_fee").eq("partner_id", p.id).order("created_at");
        if (pr) setPricing(pr);
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, authLoading]);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };
  const updatePartnerField = (field: string, value: any) => { setPartner({ ...partner, [field]: value }); };

  // Coerce empty-string numeric fields to null so PostgREST doesn't choke on ""
  const num = (v: any) => (v === "" || v === null || v === undefined) ? null : Number(v);
  const pick = (obj: any, keys: string[]) => {
    const out: any = {};
    for (const k of keys) if (k in obj) out[k] = obj[k];
    return out;
  };

  const savePartner = async () => {
    setSaving(true);
    try {
      const updates = {
        name: partner.name,
        relationship_manager: partner.relationship_manager,
        status: partner.status,
        support_phone: partner.support_phone,
        rm_phone: partner.rm_phone,
        email: partner.email,
        website: partner.website,
        residual_split: num(partner.residual_split),
        restricted_split_pct: num(partner.restricted_split_pct),
        notes: partner.notes,
        pricing_data: partner.pricing_data,
        department_contacts: partner.department_contacts,
      };
      const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
      if (error) { showMsg("Save failed: " + error.message); return; }
      showMsg("Partner saved!");
    } catch (e: any) {
      showMsg("Save failed: " + (e.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const addBank = async () => { const { data } = await supabase.from("partner_sponsor_banks").insert({ partner_id: partner.id, bank_name: "" }).select().single(); if (data) setBanks([...banks, data]); };
  const updateBank = (idx: number, field: string, value: any) => { const u = [...banks]; u[idx] = { ...u[idx], [field]: value }; setBanks(u); };
  const saveBank = async (idx: number) => {
    const key = "bank-" + idx;
    setSavingItem(key);
    try {
      const b = banks[idx];
      const updates = pick(b, ["bank_name", "cutoff_timezone", "next_day_funding", "batch_cutoff_time", "same_day_funding", "same_day_cutoff_time", "accepted_mcc_codes", "restricted_mcc_codes", "details"]);
      const { error } = await supabase.from("partner_sponsor_banks").update(updates).eq("id", b.id);
      if (error) { showMsg("Save failed: " + error.message); return; }
      showMsg("Bank saved!");
    } catch (e: any) { showMsg("Save failed: " + (e.message || "unknown error")); } finally { setSavingItem(null); }
  };
  const removeBank = async (idx: number) => { await supabase.from("partner_sponsor_banks").delete().eq("id", banks[idx].id); setBanks(banks.filter((_, i) => i !== idx)); };

  const addHardware = async () => { const { data } = await supabase.from("partner_hardware").insert({ partner_id: partner.id, hardware_name: "" }).select().single(); if (data) setHardware([...hardware, data]); };
  const updateHw = (idx: number, field: string, value: any) => { const u = [...hardware]; u[idx] = { ...u[idx], [field]: value }; setHardware(u); };
  const saveHw = async (idx: number) => {
    const key = "hw-" + idx;
    setSavingItem(key);
    try {
      const h = hardware[idx];
      const updates = pick(h, ["hardware_type", "hardware_name", "manufacturer", "model", "details", "notes"]);
      updates.cost = num(h.cost);
      updates.msrp = num(h.msrp);
      updates.partner_cost = num(h.partner_cost);
      updates.free_placement_eligible = h.free_placement_eligible;
      const { error } = await supabase.from("partner_hardware").update(updates).eq("id", h.id);
      if (error) { showMsg("Save failed: " + error.message); return; }
      showMsg("Hardware saved!");
    } catch (e: any) { showMsg("Save failed: " + (e.message || "unknown error")); } finally { setSavingItem(null); }
  };
  const removeHw = async (idx: number) => { await supabase.from("partner_hardware").delete().eq("id", hardware[idx].id); setHardware(hardware.filter((_, i) => i !== idx)); };

  const addSoftware = async () => { const { data } = await supabase.from("partner_software").insert({ partner_id: partner.id, software_name: "" }).select().single(); if (data) setSoftware([...software, data]); };
  const updateSw = (idx: number, field: string, value: any) => { const u = [...software]; u[idx] = { ...u[idx], [field]: value }; setSoftware(u); };
  const saveSw = async (idx: number) => {
    const key = "sw-" + idx;
    setSavingItem(key);
    try {
      const s = software[idx];
      const updates = pick(s, ["software_name", "software_type", "manufacturer", "details", "notes"]);
      updates.monthly_cost = num(s.monthly_cost);
      updates.per_transaction_cost = num(s.per_transaction_cost);
      updates.per_txn_cost = num(s.per_txn_cost);
      updates.msrp = num(s.msrp);
      updates.partner_cost = num(s.partner_cost);
      const { error } = await supabase.from("partner_software").update(updates).eq("id", s.id);
      if (error) { showMsg("Save failed: " + error.message); return; }
      showMsg("Software saved!");
    } catch (e: any) { showMsg("Save failed: " + (e.message || "unknown error")); } finally { setSavingItem(null); }
  };
  const removeSw = async (idx: number) => { await supabase.from("partner_software").delete().eq("id", software[idx].id); setSoftware(software.filter((_, i) => i !== idx)); };

  const addUw = async () => { const { data } = await supabase.from("partner_underwriting").insert({ partner_id: partner.id, guideline_name: "" }).select().single(); if (data) setUnderwriting([...underwriting, data]); };
  const updateUw = (idx: number, field: string, value: any) => { const u = [...underwriting]; u[idx] = { ...u[idx], [field]: value }; setUnderwriting(u); };
  const saveUw = async (idx: number) => {
    const key = "uw-" + idx;
    setSavingItem(key);
    try {
      const uw = underwriting[idx];
      const updates = pick(uw, ["guideline_name", "description", "restricted_industries", "details"]);
      updates.max_volume = num(uw.max_volume);
      updates.max_ticket = num(uw.max_ticket);
      const { error } = await supabase.from("partner_underwriting").update(updates).eq("id", uw.id);
      if (error) { showMsg("Save failed: " + error.message); return; }
      showMsg("Guideline saved!");
    } catch (e: any) { showMsg("Save failed: " + (e.message || "unknown error")); } finally { setSavingItem(null); }
  };
  const removeUw = async (idx: number) => { await supabase.from("partner_underwriting").delete().eq("id", underwriting[idx].id); setUnderwriting(underwriting.filter((_, i) => i !== idx)); };

  const addPr = async () => { const { data } = await supabase.from("partner_pricing").insert({ partner_id: partner.id, schedule_name: "" }).select().single(); if (data) setPricing([...pricing, data]); };
  const updatePr = (idx: number, field: string, value: any) => { const u = [...pricing]; u[idx] = { ...u[idx], [field]: value }; setPricing(u); };
  const savePr = async (idx: number) => {
    const key = "pr-" + idx;
    setSavingItem(key);
    try {
      const pr = pricing[idx];
      const updates = pick(pr, ["schedule_name", "pricing_model"]);
      updates.discount_rate = num(pr.discount_rate);
      updates.per_transaction_fee = num(pr.per_transaction_fee);
      updates.monthly_fee = num(pr.monthly_fee);
      const { error } = await supabase.from("partner_pricing").update(updates).eq("id", pr.id);
      if (error) { showMsg("Save failed: " + error.message); return; }
      showMsg("Pricing saved!");
    } catch (e: any) { showMsg("Save failed: " + (e.message || "unknown error")); } finally { setSavingItem(null); }
  };
  const removePr = async (idx: number) => { await supabase.from("partner_pricing").delete().eq("id", pricing[idx].id); setPricing(pricing.filter((_, i) => i !== idx)); };

  // MPA documents state — uses mpa_templates table
  const [bankMpas, setBankMpas] = useState<Record<string, any[]>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [mpaUploading, setMpaUploading] = useState<Record<string, boolean>>({});

  const fetchMpasForBanks = async (bankList: any[]) => {
    if (!bankList.length || !partner) return;
    const { data: tpls } = await supabase
      .from("mpa_templates")
      .select("*")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });
    if (tpls) {
      const grouped: Record<string, any[]> = {};
      for (const t of tpls) {
        const matchBank = bankList.find((b: any) => b.bank_name === t.sponsor_bank);
        if (matchBank) {
          if (!grouped[matchBank.id]) grouped[matchBank.id] = [];
          grouped[matchBank.id].push(t);
        }
      }
      setBankMpas(grouped);
    }
  };

  const fetchMpasForBank = async (bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    if (!bank || !partner) return;
    const { data: tpls } = await supabase
      .from("mpa_templates")
      .select("*")
      .eq("partner_id", partner.id)
      .eq("sponsor_bank", bank.bank_name)
      .order("created_at", { ascending: false });
    setBankMpas(prev => ({ ...prev, [bankId]: tpls || [] }));
  };

  const toggleTemplateActive = async (template: any, bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    if (!bank) return;
    if (!template.is_active) {
      await supabase.from("mpa_templates").update({ is_active: false }).eq("partner_id", partner.id).eq("sponsor_bank", bank.bank_name);
      await supabase.from("mpa_templates").update({ is_active: true }).eq("id", template.id);
    } else {
      await supabase.from("mpa_templates").update({ is_active: false }).eq("id", template.id);
    }
    await fetchMpasForBank(bankId);
  };

  const deleteTemplate = async (template: any, bankId: string) => {
    if (template.template_file_url) {
      await supabase.storage.from("deal-documents").remove([template.template_file_url]);
    }
    await supabase.from("mpa_templates").delete().eq("id", template.id);
    await fetchMpasForBank(bankId);
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
      showMsg("Upload failed — check bucket permissions");
      setMpaUploading(prev => ({ ...prev, [bankId]: false }));
      return;
    }

    const bank = banks.find(b => b.id === bankId);
    const templateName = `${partner.name} - ${bank?.bank_name || "Bank"} - ${file.name}`;

    const { error: insertError } = await supabase.from("mpa_templates").insert({
      org_id: member?.org_id || null,
      partner_id: partner.id,
      sponsor_bank: bank?.bank_name || "",
      template_name: templateName,
      template_file_url: path,
      is_active: true,
    });

    if (insertError) {
      showMsg("Failed to save MPA record");
      setMpaUploading(prev => ({ ...prev, [bankId]: false }));
      return;
    }

    await fetchMpasForBank(bankId);
    setMpaUploading(prev => ({ ...prev, [bankId]: false }));
    showMsg("MPA uploaded!");
  };

  const openSignedUrl = async (fileUrlOrPath: string) => {
    if (signedUrls[fileUrlOrPath]) {
      window.open(signedUrls[fileUrlOrPath], "_blank");
      return;
    }
    const signed = await getSignedUrl(fileUrlOrPath);
    if (signed) {
      setSignedUrls(prev => ({ ...prev, [fileUrlOrPath]: signed }));
      window.open(signed, "_blank");
    }
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

  const fetchAgreements = async () => {
    if (agreementsFetched || !partner) return;
    const { data } = await supabase
      .from("partner_agreements")
      .select("id, file_name, file_url, agreement_type, description, uploaded_at")
      .eq("partner_id", partner.id)
      .order("uploaded_at", { ascending: false });
    if (data) setAgreements(data);
    setAgreementsFetched(true);
  };

  const fetchRepCodes = async () => {
    if (repCodesFetched || !partner || !member?.org_id) return;
    const { data } = await supabase
      .from("agent_rep_codes")
      .select("id, user_id, rep_code, label, status, split_pct, bonus_per_deal, house_split_override_pct, restricted_split_pct, payout_type, code_type, effective_date, end_date, notes")
      .eq("partner_id", partner.id)
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false });
    setPartnerRepCodes(data || []);
    // Fetch agent names
    const uids = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from("user_profiles").select("user_id, full_name, email").in("user_id", uids);
      const map: Record<string, string> = {};
      for (const p of profiles || []) map[p.user_id] = p.full_name || p.email || p.user_id.slice(0, 8);
      setRepProfiles(map);
    }
    // Fetch org default house split
    if (member?.org_id) {
      const { data: orgData } = await supabase.from("organizations").select("default_house_split_pct").eq("id", member.org_id).single();
      setOrgDefaultHouseSplit(orgData?.default_house_split_pct || 0);
    }
    // Fetch all active org members for rep code assignment
    if (member?.org_id) {
      const { data: members } = await supabase.from("org_members").select("user_id, role").eq("org_id", member.org_id).eq("status", "active").not("user_id", "is", null);
      const activeMembers = members || [];
      if (activeMembers.length > 0) {
        const { data: agentProfiles } = await supabase.from("user_profiles").select("user_id, full_name, email").in("user_id", activeMembers.map(a => a.user_id));
        const enriched = activeMembers.map(a => {
          const p = (agentProfiles || []).find(p => p.user_id === a.user_id);
          return { ...a, name: p?.full_name || p?.email || a.user_id.slice(0, 8) };
        });
        setRepAgents(enriched);
        // Update profiles map
        const newMap = { ...repProfiles };
        for (const p of agentProfiles || []) newMap[p.user_id] = p.full_name || p.email || p.user_id.slice(0, 8);
        setRepProfiles(newMap);
      }
    }
    setRepCodesFetched(true);
  };

  const fetchResiduals = async () => {
    if (resFetched || !partner) return;
    setResFetched(true);
    const { data: imports } = await supabase
      .from("residual_imports")
      .select("id, report_month, processor_name, file_name, status, created_at")
      .eq("partner_id", partner.id)
      .order("report_month", { ascending: false });
    if (!imports) return;
    setResImports(imports);
    // Build trending from all imports
    const monthMap: Record<string, number> = {};
    for (const imp of imports) {
      if (imp.status !== "completed") continue;
      const { data: recs } = await supabase
        .from("residual_records")
        .select("net_revenue")
        .eq("import_id", imp.id);
      const total = (recs || []).reduce((s: number, r: any) => s + (r.net_revenue || 0), 0);
      monthMap[imp.report_month] = (monthMap[imp.report_month] || 0) + total;
    }
    setResTrending(
      Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, net]) => ({ month, net: Math.round(net * 100) / 100 }))
    );
  };

  const fetchImportRecords = async (importId: string) => {
    if (resRecords[importId]) return;
    const { data } = await supabase
      .from("residual_records")
      .select("id, merchant_id, merchant_id_external, dba_name, gross_income, total_expenses, net_revenue, sales_amount, agent_user_id")
      .eq("import_id", importId)
      .order("net_revenue", { ascending: false });
    setResRecords(prev => ({ ...prev, [importId]: data || [] }));
  };

  const toggleImportExpand = async (importId: string) => {
    if (resExpandedId === importId) { setResExpandedId(null); return; }
    setResExpandedId(importId);
    await fetchImportRecords(importId);
  };

  // Anomaly detection: compare current month records to prior month
  const getAnomalyBadge = (importId: string, merchantKey: string, netRevenue: number) => {
    const imports = resImports.filter(i => i.status === "completed");
    const idx = imports.findIndex(i => i.id === importId);
    if (idx < 0 || idx >= imports.length - 1) return null;
    const priorId = imports[idx + 1]?.id;
    const priorRecs = resRecords[priorId];
    if (!priorRecs) return null;
    const priorRec = priorRecs.find(r => (r.merchant_id_external || r.dba_name) === merchantKey);
    if (!priorRec) return <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium ml-1">New</span>;
    if (netRevenue === 0 && (priorRec.net_revenue || 0) > 0) return <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium ml-1">Zero</span>;
    if (priorRec.net_revenue > 0 && netRevenue < priorRec.net_revenue * 0.8) return <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium ml-1">-{Math.round((1 - netRevenue / priorRec.net_revenue) * 100)}%</span>;
    return null;
  };

  const [repWarning, setRepWarning] = useState('');

  const handleSavePartnerRepCode = async () => {
    if (!repForm.rep_code.trim()) { setRepError("Rep code is required"); return; }
    if (!repForm.user_id) { setRepError("Agent is required"); return; }
    setRepSaving(true);
    setRepError("");
    setRepWarning("");

    // Validate splits
    const newSplit = repForm.split_pct ? parseFloat(repForm.split_pct) : 0;
    if (repForm.payout_type === "agent_paid" && repForm.code_type === "standard") {
      const partnerAgreement = partner?.residual_split ?? 100;
      const otherSplits = partnerRepCodes
        .filter((rc: any) => rc.status === "active" && rc.code_type === "standard")
        .reduce((s: number, rc: any) => s + (rc.split_pct || 0), 0);
      const housePct = repForm.house_split_override_pct ? parseFloat(repForm.house_split_override_pct) : 0;
      const total = housePct + otherSplits + newSplit;
      if (total > partnerAgreement) {
        setRepWarning(`Combined splits (${total.toFixed(1)}%) exceed partner agreement (${partnerAgreement}%).`);
      }
    }
    const { error } = await supabase.from("agent_rep_codes").insert({
      org_id: member?.org_id,
      user_id: repForm.user_id,
      partner_id: partner.id,
      rep_code: repForm.rep_code.trim(),
      label: repForm.label.trim() || null,
      split_pct: repForm.split_pct ? parseFloat(repForm.split_pct) : null,
      bonus_per_deal: repForm.bonus_per_deal ? parseFloat(repForm.bonus_per_deal) : null,
      house_split_override_pct: repForm.house_split_override_pct ? parseFloat(repForm.house_split_override_pct) : null,
      restricted_split_pct: repForm.restricted_split_pct ? parseFloat(repForm.restricted_split_pct) : null,
      payout_type: repForm.payout_type || 'agent_paid',
      code_type: repForm.code_type || 'standard',
      effective_date: repForm.effective_date || null,
      notes: repForm.notes.trim() || null,
      status: "active",
    });
    setRepSaving(false);
    if (error) {
      setRepError(error.message.includes("unique") ? "This rep code already exists for this partner." : error.message);
      return;
    }
    setShowRepModal(false);
    setRepCodesFetched(false);
    fetchRepCodes();
    showMsg("Rep code added!");
  };

  const handleDeactivatePartnerRepCode = async (rc: any) => {
    if (!confirm(`Deactivate rep code "${rc.rep_code}"?`)) return;
    await supabase.from("agent_rep_codes").update({
      status: "inactive",
      end_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    }).eq("id", rc.id);
    setRepCodesFetched(false);
    fetchRepCodes();
    showMsg("Rep code deactivated.");
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div><label className={labelClass}>Residual Split %</label><input type="number" min={0} max={100} step={0.01} value={partner.residual_split ?? ""} onChange={(e) => updatePartnerField("residual_split", e.target.value)} className={inputClass} placeholder="e.g. 50" /></div>
            <div><label className={labelClass}>Restricted / High-Risk Split %</label><input type="number" min={0} max={100} step={0.01} value={partner.restricted_split_pct ?? ""} onChange={(e) => updatePartnerField("restricted_split_pct", e.target.value)} className={inputClass} placeholder="e.g. 50" /></div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Notes</label>
            <textarea value={partner.notes || ""} onChange={(e) => updatePartnerField("notes", e.target.value)} className={inputClass + " h-20 resize-none"} />
          </div>
          {/* Department Contacts */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Department Contacts</h4>
              <button onClick={() => updatePartnerField("department_contacts", [...(partner.department_contacts || []), { name: "", email: "", phone: "" }])} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">+ Add Department</button>
            </div>
            {(!partner.department_contacts || partner.department_contacts.length === 0) ? (
              <p className="text-xs text-slate-400">No department contacts added.</p>
            ) : (
              <div className="space-y-2">
                {partner.department_contacts.map((dc: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-slate-500">Department {idx + 1}</span>
                      <button onClick={() => { const updated = [...partner.department_contacts]; updated.splice(idx, 1); updatePartnerField("department_contacts", updated); }} className="text-red-400 hover:text-red-500 text-xs">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="text" value={dc.name || ""} onChange={(e) => { const updated = [...partner.department_contacts]; updated[idx] = { ...updated[idx], name: e.target.value }; updatePartnerField("department_contacts", updated); }} className={inputClass} placeholder="e.g. Underwriting, Tech Support, Risk" />
                      <input type="email" value={dc.email || ""} onChange={(e) => { const updated = [...partner.department_contacts]; updated[idx] = { ...updated[idx], email: e.target.value }; updatePartnerField("department_contacts", updated); }} className={inputClass} placeholder="dept@partner.com" />
                      <input type="text" value={dc.phone || ""} onChange={(e) => { const updated = [...partner.department_contacts]; updated[idx] = { ...updated[idx], phone: e.target.value }; updatePartnerField("department_contacts", updated); }} className={inputClass} placeholder="(555) 123-4567" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={savePartner} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Saving..." : "Save Partner Info"}</button>
          </div>
        </div>

        <div className="flex flex-nowrap gap-2 mb-6 border-b border-slate-200 pb-2 overflow-x-auto">
          {tabs.map((t) => {
            const pricingDataCount = Array.isArray(partner?.pricing_data) ? partner.pricing_data.length : 0;
            const count = t.key === "banks" ? banks.length : t.key === "hardware" ? hardware.length : t.key === "software" ? software.length : t.key === "underwriting" ? underwriting.length : t.key === "merchants" ? partnerMerchants.length : t.key === "agreements" ? agreements.length : t.key === "repcodes" ? partnerRepCodes.length : t.key === "pricing" ? pricing.length + pricingDataCount : t.key === "residuals" ? resImports.length : 0;
            return (
              <button key={t.key} onClick={() => { setActiveTab(t.key); if (t.key === "merchants") fetchMerchants(); if (t.key === "agreements") fetchAgreements(); if (t.key === "repcodes") fetchRepCodes(); if (t.key === "residuals") fetchResiduals(); }} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap ${activeTab === t.key ? "bg-white text-slate-900 border-b-2 border-emerald-500" : "text-slate-400 hover:text-slate-900"}`}>
                {t.label} ({count})
              </button>
            );
          })}
        </div>

        {activeTab === "banks" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Merchant Applications</h4>
              <button onClick={addBank} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Bank</button>
            </div>
            {banks.length === 0 && <p className="text-slate-500 text-sm">No merchant applications added yet.</p>}
            {banks.map((b, idx) => (
              <div key={b.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Bank {idx + 1}</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => saveBank(idx)} disabled={savingItem === "bank-" + idx} className="text-emerald-600 hover:text-emerald-700 text-xs disabled:opacity-50">{savingItem === "bank-" + idx ? "Saving..." : "Save"}</button>
                    <button onClick={() => removeBank(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                {/* ROW 1: Application Name + Cutoff Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div><label className={labelClass}>Application Name</label><input type="text" value={b.bank_name || ""} onChange={(e) => updateBank(idx, "bank_name", e.target.value)} className={inputClass} /></div>
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
                  <div className="mt-2 divide-y divide-slate-50">
                    {(bankMpas[b.id] || []).map((tpl: any) => (
                        <div key={tpl.id} className="flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => openSignedUrl(tpl.template_file_url)} className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 truncate text-left">
                              📄 {tpl.template_name}
                            </button>
                            {tpl.is_active && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium shrink-0">Active</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs text-slate-400">
                              {new Date(tpl.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <button
                              onClick={() => toggleTemplateActive(tpl, b.id)}
                              className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${tpl.is_active ? "bg-emerald-500" : "bg-slate-200"}`}
                              title={tpl.is_active ? "Deactivate" : "Set as active"}
                            >
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${tpl.is_active ? "right-0.5" : "left-0.5"}`} />
                            </button>
                            <button onClick={() => deleteTemplate(tpl, b.id)} className="text-red-400 hover:text-red-500 text-xs">Remove</button>
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
              <div className="flex gap-2">
                <label className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition">
                  {hwExtracting ? "Extracting..." : "Upload Hardware Sheet"}
                  <input
                    type="file"
                    accept=".pdf,.csv"
                    className="hidden"
                    disabled={hwExtracting}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setHwExtracting(true);
                      try {
                        const formData = new FormData();
                        formData.append("pdf", file);
                        const res = await authFetch("/api/extract-hardware", { method: "POST", body: formData });
                        const data = await res.json();
                        if (data.hardware && Array.isArray(data.hardware) && data.hardware.length > 0) {
                          setHwPreview(data.hardware);
                          setHwSelected(new Set(data.hardware.map((_: any, i: number) => i)));
                        } else {
                          showMsg("Could not extract hardware from file.");
                        }
                      } catch {
                        showMsg("Hardware extraction failed.");
                      }
                      setHwExtracting(false);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button onClick={addHardware} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Hardware</button>
              </div>
            </div>

            {/* Hardware Preview Modal */}
            {hwPreview && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900">Extracted Hardware — {hwPreview.length} item(s)</h3>
                    <button onClick={() => setHwPreview(null)} className="text-slate-400 hover:text-slate-600 text-lg">x</button>
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium w-8">
                            <input type="checkbox" checked={hwSelected.size === hwPreview.length} onChange={(e) => {
                              if (e.target.checked) setHwSelected(new Set(hwPreview.map((_, i) => i)));
                              else setHwSelected(new Set());
                            }} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                          </th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Type</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Name</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Model</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Manufacturer</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">Cost</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">MSRP</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Free Placement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hwPreview.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={hwSelected.has(idx)} onChange={(e) => {
                                const next = new Set(hwSelected);
                                if (e.target.checked) next.add(idx); else next.delete(idx);
                                setHwSelected(next);
                              }} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                            </td>
                            <td className="px-3 py-2 capitalize">{item.hardware_type?.replace('_', ' ') || '-'}</td>
                            <td className="px-3 py-2">{item.hardware_name || '-'}</td>
                            <td className="px-3 py-2">{item.model || '-'}</td>
                            <td className="px-3 py-2">{item.manufacturer || '-'}</td>
                            <td className="px-3 py-2 text-right">{item.cost != null ? `$${item.cost}` : '-'}</td>
                            <td className="px-3 py-2 text-right">{item.msrp != null ? `$${item.msrp}` : '-'}</td>
                            <td className="px-3 py-2">{item.free_placement_eligible ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={() => setHwPreview(null)} className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm">Cancel</button>
                    <button onClick={async () => {
                      const selected = hwPreview.filter((_, i) => hwSelected.has(i));
                      for (const item of selected) {
                        const { data: inserted } = await supabase.from("partner_hardware").insert({
                          partner_id: partner.id,
                          hardware_type: item.hardware_type || "",
                          hardware_name: item.hardware_name || "",
                          model: item.model || "",
                          manufacturer: item.manufacturer || "",
                          cost: item.cost || null,
                          msrp: item.msrp || null,
                          free_placement_eligible: item.free_placement_eligible || false,
                        }).select().single();
                        if (inserted) setHardware((prev) => [...prev, inserted]);
                      }
                      showMsg(`${selected.length} hardware item(s) imported!`);
                      setHwPreview(null);
                    }} disabled={hwSelected.size === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                      Import Selected ({hwSelected.size})
                    </button>
                    <button onClick={async () => {
                      for (const item of hwPreview) {
                        const { data: inserted } = await supabase.from("partner_hardware").insert({
                          partner_id: partner.id,
                          hardware_type: item.hardware_type || "",
                          hardware_name: item.hardware_name || "",
                          model: item.model || "",
                          manufacturer: item.manufacturer || "",
                          cost: item.cost || null,
                          msrp: item.msrp || null,
                          free_placement_eligible: item.free_placement_eligible || false,
                        }).select().single();
                        if (inserted) setHardware((prev) => [...prev, inserted]);
                      }
                      showMsg(`${hwPreview.length} hardware item(s) imported!`);
                      setHwPreview(null);
                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                      Import All ({hwPreview.length})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {hardware.length === 0 && <p className="text-slate-500 text-sm">No hardware options added yet. Upload a sheet or add manually.</p>}
            {hardware.map((h, idx) => (
              <div key={h.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Hardware {idx + 1}</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => saveHw(idx)} disabled={savingItem === "hw-" + idx} className="text-emerald-600 hover:text-emerald-700 text-xs disabled:opacity-50">{savingItem === "hw-" + idx ? "Saving..." : "Save"}</button>
                    <button onClick={() => removeHw(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                  <div><label className={labelClass}>Hardware Type</label><select value={h.hardware_type || ""} onChange={(e) => updateHw(idx, "hardware_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="terminal">Terminal</option><option value="mobile_reader">Mobile Reader</option><option value="pos">POS System</option><option value="pin_pad">Pin Pad</option><option value="printer">Printer</option><option value="other">Other</option></select></div>
                  <div><label className={labelClass}>Hardware Name</label><input type="text" value={h.hardware_name || ""} onChange={(e) => updateHw(idx, "hardware_name", e.target.value)} className={inputClass} placeholder="e.g. Dejavoo QD4" /></div>
                  <div><label className={labelClass}>Manufacturer</label><input type="text" value={h.manufacturer || ""} onChange={(e) => updateHw(idx, "manufacturer", e.target.value)} className={inputClass} placeholder="e.g. Dejavoo, PAX" /></div>
                  <div><label className={labelClass}>Model</label><input type="text" value={h.model || ""} onChange={(e) => updateHw(idx, "model", e.target.value)} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Partner Cost ($)</label><input type="number" step="0.01" value={h.cost || ""} onChange={(e) => updateHw(idx, "cost", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>MSRP ($)</label><input type="number" step="0.01" value={h.msrp || ""} onChange={(e) => updateHw(idx, "msrp", e.target.value)} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Free Placement Eligible</label>
                    <select value={h.free_placement_eligible === true ? "yes" : h.free_placement_eligible === false ? "no" : ""} onChange={(e) => updateHw(idx, "free_placement_eligible", e.target.value === "yes" ? true : e.target.value === "no" ? false : null)} className={inputClass}>
                      <option value="">Select...</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "software" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-emerald-600">Software Options</h4>
              <div className="flex gap-2">
                <label className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition">
                  {swExtracting ? "Extracting..." : "Upload Software Sheet"}
                  <input
                    type="file"
                    accept=".pdf,.csv"
                    className="hidden"
                    disabled={swExtracting}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSwExtracting(true);
                      try {
                        const formData = new FormData();
                        formData.append("pdf", file);
                        const res = await authFetch("/api/extract-software", { method: "POST", body: formData });
                        const data = await res.json();
                        if (data.software && Array.isArray(data.software) && data.software.length > 0) {
                          setSwPreview(data.software);
                          setSwSelected(new Set(data.software.map((_: any, i: number) => i)));
                        } else {
                          showMsg("Could not extract software from file.");
                        }
                      } catch {
                        showMsg("Software extraction failed.");
                      }
                      setSwExtracting(false);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button onClick={addSoftware} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Software</button>
              </div>
            </div>

            {/* Software Preview Modal */}
            {swPreview && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900">Extracted Software — {swPreview.length} item(s)</h3>
                    <button onClick={() => setSwPreview(null)} className="text-slate-400 hover:text-slate-600 text-lg">x</button>
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium w-8">
                            <input type="checkbox" checked={swSelected.size === swPreview.length} onChange={(e) => {
                              if (e.target.checked) setSwSelected(new Set(swPreview.map((_, i) => i)));
                              else setSwSelected(new Set());
                            }} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                          </th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Name</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Type</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Manufacturer</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">Monthly</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">Per Txn</th>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {swPreview.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={swSelected.has(idx)} onChange={(e) => {
                                const next = new Set(swSelected);
                                if (e.target.checked) next.add(idx); else next.delete(idx);
                                setSwSelected(next);
                              }} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                            </td>
                            <td className="px-3 py-2">{item.software_name || '-'}</td>
                            <td className="px-3 py-2 capitalize">{item.software_type?.replace('_', ' ') || '-'}</td>
                            <td className="px-3 py-2">{item.manufacturer || '-'}</td>
                            <td className="px-3 py-2 text-right">{item.monthly_cost != null ? `$${item.monthly_cost}` : '-'}</td>
                            <td className="px-3 py-2 text-right">{item.per_transaction_cost != null ? `$${item.per_transaction_cost}` : '-'}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs max-w-[200px] truncate">{item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={() => setSwPreview(null)} className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm">Cancel</button>
                    <button onClick={async () => {
                      const selected = swPreview.filter((_, i) => swSelected.has(i));
                      for (const item of selected) {
                        const { data: inserted } = await supabase.from("partner_software").insert({
                          partner_id: partner.id,
                          software_name: item.software_name || "",
                          software_type: item.software_type || "",
                          manufacturer: item.manufacturer || "",
                          monthly_cost: item.monthly_cost || null,
                          per_transaction_cost: item.per_transaction_cost || null,
                          notes: item.notes || "",
                        }).select().single();
                        if (inserted) setSoftware((prev) => [...prev, inserted]);
                      }
                      showMsg(`${selected.length} software item(s) imported!`);
                      setSwPreview(null);
                    }} disabled={swSelected.size === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                      Import Selected ({swSelected.size})
                    </button>
                    <button onClick={async () => {
                      for (const item of swPreview) {
                        const { data: inserted } = await supabase.from("partner_software").insert({
                          partner_id: partner.id,
                          software_name: item.software_name || "",
                          software_type: item.software_type || "",
                          manufacturer: item.manufacturer || "",
                          monthly_cost: item.monthly_cost || null,
                          per_transaction_cost: item.per_transaction_cost || null,
                          notes: item.notes || "",
                        }).select().single();
                        if (inserted) setSoftware((prev) => [...prev, inserted]);
                      }
                      showMsg(`${swPreview.length} software item(s) imported!`);
                      setSwPreview(null);
                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                      Import All ({swPreview.length})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {software.length === 0 && <p className="text-slate-500 text-sm">No software options added yet. Upload a sheet or add manually.</p>}
            {software.map((s, idx) => (
              <div key={s.id} className={cardClass}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Software {idx + 1}</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => saveSw(idx)} disabled={savingItem === "sw-" + idx} className="text-emerald-600 hover:text-emerald-700 text-xs disabled:opacity-50">{savingItem === "sw-" + idx ? "Saving..." : "Save"}</button>
                    <button onClick={() => removeSw(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                  <div><label className={labelClass}>Software Name</label><input type="text" value={s.software_name || ""} onChange={(e) => updateSw(idx, "software_name", e.target.value)} className={inputClass} placeholder="e.g. Authorize.net" /></div>
                  <div><label className={labelClass}>Type</label><select value={s.software_type || ""} onChange={(e) => updateSw(idx, "software_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="gateway">Gateway</option><option value="pos">POS</option><option value="plugin">Plugin</option><option value="integration">Integration</option><option value="virtual_terminal">Virtual Terminal</option><option value="reporting">Reporting</option></select></div>
                  <div><label className={labelClass}>Manufacturer</label><input type="text" value={s.manufacturer || ""} onChange={(e) => updateSw(idx, "manufacturer", e.target.value)} className={inputClass} placeholder="e.g. Authorize.net" /></div>
                  <div><label className={labelClass}>Monthly Cost ($)</label><input type="number" step="0.01" value={s.monthly_cost || ""} onChange={(e) => updateSw(idx, "monthly_cost", e.target.value)} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Per Transaction ($)</label><input type="number" step="0.01" value={s.per_transaction_cost || ""} onChange={(e) => updateSw(idx, "per_transaction_cost", e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2 lg:col-span-3"><label className={labelClass}>Notes</label><input type="text" value={s.notes || ""} onChange={(e) => updateSw(idx, "notes", e.target.value)} className={inputClass} placeholder="Features, restrictions, etc." /></div>
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
                    <button type="button" onClick={() => saveUw(idx)} disabled={savingItem === "uw-" + idx} className="text-emerald-600 hover:text-emerald-700 text-xs disabled:opacity-50">{savingItem === "uw-" + idx ? "Saving..." : "Save"}</button>
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
                    <button type="button" onClick={() => savePr(idx)} disabled={savingItem === "pr-" + idx} className="text-emerald-600 hover:text-emerald-700 text-xs disabled:opacity-50">{savingItem === "pr-" + idx ? "Saving..." : "Save"}</button>
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

        {activeTab === "agreements" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-semibold text-slate-900">Agreements</h4>
              <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition">
                {agreementUploading ? "Uploading..." : "Upload Agreement"}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg"
                  className="hidden"
                  disabled={agreementUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAgreementUploading(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) { setAgreementUploading(false); return; }
                      const timestamp = Date.now();
                      const path = `${user.id}/${partner.id}/agreements/${timestamp}_${file.name}`;
                      const { error: uploadError } = await supabase.storage.from("deal-documents").upload(path, file);
                      if (uploadError) { showMsg("Upload failed."); setAgreementUploading(false); e.target.value = ""; return; }
                      setAgreementPending({ file_name: file.name, file_url: path });
                      setAgreementForm({ agreement_type: "", description: "" });
                    } catch {
                      showMsg("Upload failed.");
                    }
                    setAgreementUploading(false);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {/* Agreement metadata modal */}
            {agreementPending && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Agreement Details</h3>
                  <p className="text-sm text-slate-500 mb-4">File: {agreementPending.file_name}</p>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Agreement Type *</label>
                      <select value={agreementForm.agreement_type} onChange={(e) => setAgreementForm({ ...agreementForm, agreement_type: e.target.value })} className={inputClass}>
                        <option value="">Select type...</option>
                        <option value="ISO Agreement">ISO Agreement</option>
                        <option value="Agent Agreement">Agent Agreement</option>
                        <option value="Schedule A">Schedule A</option>
                        <option value="Buy Rate Sheet">Buy Rate Sheet</option>
                        <option value="Revenue Share Agreement">Revenue Share Agreement</option>
                        <option value="NDA">NDA</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Description</label>
                      <input type="text" value={agreementForm.description} onChange={(e) => setAgreementForm({ ...agreementForm, description: e.target.value })} className={inputClass} placeholder="e.g., 2026 updated ISO agreement" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={async () => {
                      if (agreementPending.file_url) {
                        await supabase.storage.from("deal-documents").remove([agreementPending.file_url]);
                      }
                      setAgreementPending(null);
                    }} className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm">Cancel</button>
                    <button type="button" onClick={async () => {
                      if (!agreementForm.agreement_type) { showMsg("Please select an agreement type."); return; }
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      const { data: inserted, error } = await supabase.from("partner_agreements").insert({
                        partner_id: partner.id,
                        user_id: user.id,
                        file_name: agreementPending.file_name,
                        file_url: agreementPending.file_url,
                        agreement_type: agreementForm.agreement_type,
                        description: agreementForm.description || null,
                      }).select().single();
                      if (error) { showMsg("Save failed: " + error.message); return; }
                      if (inserted) setAgreements((prev) => [inserted, ...prev]);
                      setAgreementPending(null);
                      showMsg("Agreement uploaded!");
                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Save Agreement</button>
                  </div>
                </div>
              </div>
            )}

            {agreements.length === 0 ? (
              <p className="text-sm text-slate-400">No agreements uploaded yet.</p>
            ) : (
              agreements.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3">
                  <div className="flex justify-between items-center">
                    <button onClick={() => openSignedUrl(a.file_url)} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 truncate max-w-[60%] text-left">
                      {a.file_name}
                    </button>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{a.agreement_type}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-500">{a.description || "No description"}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {new Date(a.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <button onClick={async () => {
                        if (!confirm("Remove this agreement?")) return;
                        if (a.file_url) {
                          await supabase.storage.from("deal-documents").remove([a.file_url]);
                        }
                        await supabase.from("partner_agreements").delete().eq("id", a.id);
                        setAgreements((prev) => prev.filter((ag) => ag.id !== a.id));
                        showMsg("Agreement removed.");
                      }} className="text-red-400 hover:text-red-500 text-xs">Remove</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* REP CODES TAB */}
        {activeTab === "repcodes" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Rep Codes</h3>
              <button onClick={() => { setRepForm({ user_id: '', rep_code: '', label: '', split_pct: '', bonus_per_deal: '', house_split_override_pct: '', restricted_split_pct: '', payout_type: 'agent_paid', code_type: 'standard', effective_date: '', notes: '' }); setRepError(''); setShowRepModal(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">+ Add Rep Code</button>
            </div>

            {partnerRepCodes.length === 0 ? (
              <p className="text-sm text-slate-400">No rep codes for this partner yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="px-4 py-2.5 font-medium">Agent</th>
                      <th className="px-4 py-2.5 font-medium">Rep Code</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Label</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Split %</th>
                      <th className="px-4 py-2.5 font-medium">Bonus / Deal</th>
                      <th className="px-4 py-2.5 font-medium">Effective</th>
                      <th className="px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerRepCodes.map((rc) => (
                      <tr key={rc.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium">{repProfiles[rc.user_id] || rc.user_id?.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-700">{rc.rep_code}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rc.code_type === "override" ? "bg-purple-50 text-purple-700" : rc.code_type === "direct_sub" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {rc.code_type === "override" ? "Override" : rc.code_type === "direct_sub" ? "Direct" : "Standard"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{rc.label || "-"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rc.status === "active" ? "bg-emerald-50 text-emerald-700" : rc.status === "transferred" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{rc.status}</span>
                        </td>
                        <td className="px-4 py-2.5">{rc.split_pct != null ? `${rc.split_pct}%` : "-"}</td>
                        <td className="px-4 py-2.5">{rc.bonus_per_deal != null ? `$${Number(rc.bonus_per_deal).toFixed(2)}` : "\u2014"}</td>
                        <td className="px-4 py-2.5 text-slate-500">{rc.effective_date || "-"}</td>
                        <td className="px-4 py-2.5">
                          {rc.status === "active" && (
                            <button onClick={() => handleDeactivatePartnerRepCode(rc)} className="text-red-500 hover:text-red-600 text-xs font-medium">Deactivate</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Split Summary Card */}
            {partner && (() => {
              const partnerAgreement = partner.residual_split ?? 0;
              const activeStandard = partnerRepCodes.filter((rc: any) => rc.status === 'active' && rc.code_type === 'standard');
              const totalAgentSplits = activeStandard.reduce((s: number, rc: any) => s + (rc.split_pct || 0), 0);
              const maxHouse = activeStandard.reduce((max: number, rc: any) => Math.max(max, rc.house_split_override_pct || 0), 0);
              const housePct = maxHouse || 0;
              const remaining = partnerAgreement - housePct - totalAgentSplits;
              const color = remaining < 0 ? 'border-red-200 bg-red-50' : remaining > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50';
              const textColor = remaining < 0 ? 'text-red-700' : remaining > 0 ? 'text-amber-700' : 'text-emerald-700';
              return (
                <div className={`mt-6 p-4 rounded-lg border ${color}`}>
                  <p className="text-sm font-medium text-slate-800 mb-2">Split Summary</p>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div><span className="text-slate-500">Partner Agreement:</span> <span className="font-medium">{partnerAgreement}%</span></div>
                    {housePct > 0 && <div><span className="text-slate-500">ISO House Cut:</span> <span className="font-medium">{housePct}%</span></div>}
                    <div><span className="text-slate-500">Agent Splits:</span> <span className="font-medium">{totalAgentSplits}%</span></div>
                    <div><span className={`font-medium ${textColor}`}>
                      {remaining > 0 ? `${remaining.toFixed(1)}% unassigned` : remaining < 0 ? `${Math.abs(remaining).toFixed(1)}% over-allocated` : 'Fully allocated'}
                      {remaining < 0 ? ' \u26A0\uFE0F' : remaining === 0 ? ' \u2713' : ''}
                    </span></div>
                  </div>
                </div>
              );
            })()}

            {/* Agents without codes at this partner */}
            {repAgents.length > 0 && (() => {
              const assignedUids = new Set(partnerRepCodes.filter(rc => rc.status === "active").map(rc => rc.user_id));
              const unassigned = repAgents.filter(a => !assignedUids.has(a.user_id));
              if (unassigned.length === 0) return null;
              return (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-800 mb-2">Agents without a rep code at this partner:</p>
                  <div className="flex flex-wrap gap-2">
                    {unassigned.map(a => (
                      <span key={a.user_id} className="bg-white border border-amber-300 text-amber-800 text-xs px-2.5 py-1 rounded-full">{a.name}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Add Rep Code Modal */}
            {showRepModal && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md mx-4">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Add Rep Code</h3>
                      <button onClick={() => setShowRepModal(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Agent</label>
                        <select value={repForm.user_id} onChange={e => setRepForm({ ...repForm, user_id: e.target.value })} className={inputClass}>
                          <option value="">Select agent...</option>
                          {repAgents.map(a => <option key={a.user_id} value={a.user_id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Rep Code</label>
                        <input type="text" value={repForm.rep_code} onChange={e => setRepForm({ ...repForm, rep_code: e.target.value })} className={inputClass} placeholder="e.g. ABC123" />
                      </div>
                      <div>
                        <label className={labelClass}>Label (optional)</label>
                        <input type="text" value={repForm.label} onChange={e => setRepForm({ ...repForm, label: e.target.value })} className={inputClass} placeholder="e.g. John's code" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Payout Type</label>
                          <select value={repForm.payout_type} onChange={e => setRepForm({ ...repForm, payout_type: e.target.value })} className={inputClass}>
                            <option value="agent_paid">Paid through Agent</option>
                            <option value="partner_direct">Paid Direct by Partner</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Code Type</label>
                          <select value={repForm.code_type} onChange={e => setRepForm({ ...repForm, code_type: e.target.value })} className={inputClass}>
                            <option value="standard">Standard</option>
                            <option value="override">Override Earnings</option>
                            <option value="direct_sub">Direct Sub-Agent</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={labelClass}>Agent Split %</label>
                          <input type="number" min="0" max="100" step="0.01" value={repForm.split_pct} onChange={e => setRepForm({ ...repForm, split_pct: e.target.value })} className={inputClass} placeholder="Agent's earning %" />
                        </div>
                        <div>
                          <label className={labelClass}>Bonus / Deal ($)</label>
                          <input type="number" min="0" step="0.01" value={repForm.bonus_per_deal} onChange={e => setRepForm({ ...repForm, bonus_per_deal: e.target.value })} className={inputClass} placeholder="e.g. 150.00" />
                        </div>
                        <div>
                          <label className={labelClass}>Effective Date</label>
                          <input type="date" value={repForm.effective_date} onChange={e => setRepForm({ ...repForm, effective_date: e.target.value })} className={inputClass} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>ISO Cut Override %</label>
                          <input type="number" min="0" max="100" step="0.01" value={repForm.house_split_override_pct} onChange={e => setRepForm({ ...repForm, house_split_override_pct: e.target.value })} className={inputClass} placeholder="Overrides org default" />
                          <p className="text-[11px] text-slate-400 mt-1">(Leave blank to use org default of {orgDefaultHouseSplit}%)</p>
                        </div>
                        <div>
                          <label className={labelClass}>Restricted Split %</label>
                          <input type="number" min="0" max="100" step="0.01" value={repForm.restricted_split_pct} onChange={e => setRepForm({ ...repForm, restricted_split_pct: e.target.value })} className={inputClass} placeholder="High-risk split" />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Notes</label>
                        <textarea value={repForm.notes} onChange={e => setRepForm({ ...repForm, notes: e.target.value })} className={`${inputClass} resize-none`} rows={2} />
                      </div>
                      {repWarning && <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-lg text-sm">{repWarning}</div>}
                      {repError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm">{repError}</div>}
                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowRepModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Cancel</button>
                        <button type="button" onClick={handleSavePartnerRepCode} disabled={repSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                          {repSaving ? "Saving..." : "Add Rep Code"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "residuals" && (
          <div className="space-y-6">
            {/* Trending Chart */}
            {resTrending.length > 1 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Revenue Trending</h4>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={resTrending}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Net Revenue"]} />
                      <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            {resTrending.length > 0 && (() => {
              const latest = resTrending[resTrending.length - 1];
              const prev = resTrending.length > 1 ? resTrending[resTrending.length - 2] : null;
              const change = prev ? latest.net - prev.net : 0;
              const changePct = prev && prev.net !== 0 ? (change / prev.net) * 100 : 0;
              const latestImport = resImports.find(i => i.report_month === latest.month);
              const latestRecords = latestImport ? resRecords[latestImport.id] : null;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-xs text-slate-500">Latest Month Revenue</p>
                    <p className="text-xl font-bold text-emerald-600">${latest.net.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{latest.month}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-xs text-slate-500">Month-over-Month</p>
                    <p className={`text-xl font-bold ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{change >= 0 ? '+' : ''}{changePct.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400">{change >= 0 ? '+' : ''}${change.toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-xs text-slate-500">Merchants in Latest Import</p>
                    <p className="text-xl font-bold text-slate-900">{latestRecords ? latestRecords.length : '—'}</p>
                  </div>
                </div>
              );
            })()}

            {/* Import List */}
            {resImports.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                <p className="text-slate-500">No residual imports for this partner.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resImports.map(imp => {
                  const recs = resRecords[imp.id] || [];
                  const isExpanded = resExpandedId === imp.id;
                  const totalGross = recs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0);
                  const totalExp = recs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0);
                  const totalNet = recs.reduce((s: number, r: any) => s + (r.net_revenue || 0), 0);
                  return (
                    <div key={imp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button onClick={() => toggleImportExpand(imp.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-900">{imp.report_month}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${imp.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{imp.status}</span>
                          {imp.file_name && <span className="text-xs text-slate-400 truncate max-w-[200px]">{imp.file_name}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          {isExpanded && recs.length > 0 && <span className="text-xs text-slate-500">{recs.length} records</span>}
                          {isExpanded && recs.length > 0 && <span className="text-xs font-medium text-emerald-600">${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                          <span className="text-xs text-slate-400">{new Date(imp.created_at).toLocaleDateString()}</span>
                          <span className={`text-slate-400 transition-transform duration-200 text-xs ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-slate-100">
                          {recs.length === 0 ? (
                            <p className="p-4 text-sm text-slate-400">Loading records...</p>
                          ) : (
                            <>
                              <div className="flex justify-end p-2 px-4">
                                <ExportCSV
                                  data={recs.map((r: any) => ({ ...r, gross_income: r.gross_income?.toFixed(2), total_expenses: r.total_expenses?.toFixed(2), net_revenue: r.net_revenue?.toFixed(2) }))}
                                  filename={`residuals-${partner.name}-${imp.report_month}`}
                                  columns={[
                                    { key: 'dba_name', label: 'DBA' },
                                    { key: 'merchant_id_external', label: 'MID' },
                                    { key: 'gross_income', label: 'Gross Income' },
                                    { key: 'total_expenses', label: 'Expenses' },
                                    { key: 'net_revenue', label: 'Net Revenue' },
                                  ]}
                                  buttonText="Export CSV"
                                />
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-100 text-left text-slate-500 text-xs">
                                      <th className="px-4 py-2 font-medium">Merchant / DBA</th>
                                      <th className="px-4 py-2 font-medium">MID</th>
                                      <th className="px-4 py-2 font-medium text-right">Gross</th>
                                      <th className="px-4 py-2 font-medium text-right">Expenses</th>
                                      <th className="px-4 py-2 font-medium text-right">Net</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {recs.map((r: any) => {
                                      const merchantKey = r.merchant_id_external || r.dba_name || 'Unknown';
                                      const badge = getAnomalyBadge(imp.id, merchantKey, r.net_revenue || 0);
                                      return (
                                        <tr key={r.id} className="border-b border-slate-50">
                                          <td className="px-4 py-2">
                                            {r.merchant_id ? (
                                              <Link href={`/dashboard/merchants/${r.merchant_id}`} className="text-emerald-600 hover:text-emerald-700 font-medium">{r.dba_name || merchantKey}</Link>
                                            ) : (
                                              <span className="text-slate-700">{r.dba_name || merchantKey}</span>
                                            )}
                                            {badge}
                                          </td>
                                          <td className="px-4 py-2 text-slate-500 font-mono text-xs">{r.merchant_id_external || '—'}</td>
                                          <td className="px-4 py-2 text-right text-slate-700">${(r.gross_income || 0).toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right text-slate-500">${(r.total_expenses || 0).toFixed(2)}</td>
                                          <td className={`px-4 py-2 text-right font-medium ${(r.net_revenue || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${(r.net_revenue || 0).toFixed(2)}</td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-sm">
                                      <td className="px-4 py-2" colSpan={2}>Total ({recs.length} merchants)</td>
                                      <td className="px-4 py-2 text-right">${totalGross.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-right">${totalExp.toFixed(2)}</td>
                                      <td className={`px-4 py-2 text-right ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${totalNet.toFixed(2)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
      {msg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-5 py-3 rounded-lg shadow-lg text-sm font-medium ${msg.startsWith("Save failed") || msg.startsWith("Upload failed") || msg.startsWith("Failed") ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
            {msg}
          </div>
        </div>
      )}
    </div>
  );
}
