"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import CommunicationLog from "@/components/CommunicationLog";
import TaskModal from "@/components/TaskModal";
import { useAuth } from "@/lib/auth-context";

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user: authUser, member, loading: authLoading } = useAuth();
  const role = member?.role || "";
  const isOwnerOrManager = role === "owner" || role === "manager";
  const canEdit = isOwnerOrManager || role === "master_agent" || role === "agent";
  const canChangeStage = isOwnerOrManager || role === "master_agent" || role === "agent";
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [deal, setDeal] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [leadTasks, setLeadTasks] = useState<any[]>([]);
  const [fadingTaskIds, setFadingTaskIds] = useState<Set<string>>(new Set());
  const [taskToast, setTaskToast] = useState(false);
  const [owners, setOwners] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dealSaving, setDealSaving] = useState(false);
  const [dealMsg, setDealMsg] = useState("");
  const [showModal, setShowModal] = useState("");
  const [modalData, setModalData] = useState<any>({});
  const [userId, setUserId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ group1: true, group2: false, group3: false, activityLog: false });
  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const docTypes = [
    { value: "dl", label: "Driver's License" },
    { value: "processing_statements", label: "Processing Statements" },
    { value: "bank_statements", label: "Bank Statements" },
    { value: "articles", label: "Articles" },
    { value: "marketing_materials", label: "Marketing Materials" },
    { value: "supporting_docs", label: "Supporting Docs" },
  ];

  const statuses = [
    { value: "new_prospect", label: "New Prospect" },
    { value: "contact_pending", label: "Contact Pending" },
    { value: "pending_qualification", label: "Pending Qualification" },
    { value: "qualified_prospect", label: "Qualified Prospect" },
    { value: "submitted", label: "Submitted" },
    { value: "signed", label: "Signed" },
    { value: "converted", label: "Converted" },
    { value: "unqualified", label: "Unqualified" },
    { value: "unresponsive", label: "Unresponsive" },
    { value: "recycled", label: "Recycled" },
  ];

  const statusLabel = (val: string) => statuses.find(s => s.value === val)?.label || val;
  const docTypeLabel = (val: string) => docTypes.find(d => d.value === val)?.label || val;

  const unqualifiedReasons = ["Bad credit", "High risk industry", "Insufficient volume", "TMF/MATCH list", "Fraudulent activity", "Other"];

  useEffect(() => {
    if (authLoading) return;
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: leadData } = await supabase.from("leads").select("*").eq("id", params.id).single();
      if (leadData) {
        // Permission check: non-owner/manager can only see their own leads
        if (!isOwnerOrManager && leadData.assigned_to !== user.id && leadData.user_id !== user.id) {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        setLead(leadData);
        const { data: dealData } = await supabase.from("deals").select("*").eq("lead_id", leadData.id).single();
        if (dealData) {
          setDeal(dealData);
          const { data: ownerData } = await supabase.from("deal_owners").select("*").eq("deal_id", dealData.id).order("created_at");
          if (ownerData) setOwners(ownerData);
          const { data: docData } = await supabase.from("deal_documents").select("*").eq("deal_id", dealData.id).order("created_at");
          if (docData) setDocuments(docData);
        }
        const { data: actData } = await supabase.from("activity_log").select("*").eq("lead_id", leadData.id).order("created_at", { ascending: false }).limit(50);
        if (actData) setActivities(actData);
        const { data: taskData } = await supabase.from("tasks").select("id, title, due_date, priority, status").eq("lead_id", leadData.id).eq("status", "pending").order("due_date", { ascending: true });
        if (taskData) setLeadTasks(taskData);
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const fetchTasks = useCallback(async () => {
    const { data: taskData } = await supabase.from("tasks").select("id, title, due_date, priority, status").eq("lead_id", params.id).eq("status", "pending").order("due_date", { ascending: true });
    if (taskData) setLeadTasks(taskData);
    setTaskToast(true);
    setTimeout(() => setTaskToast(false), 2000);
  }, [params.id]);

  const logActivity = async (actionType: string, fieldName: string | null, oldVal: string | null, newVal: string | null, description: string) => {
    const { data } = await supabase.from("activity_log").insert({
      user_id: userId,
      lead_id: params.id as string,
      deal_id: deal?.id || null,
      action_type: actionType,
      field_name: fieldName,
      old_value: oldVal,
      new_value: newVal,
      description: description,
    }).select().single();
    if (data) setActivities([data, ...activities]);
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "unqualified") { setShowModal("unqualified"); setModalData({ reason: "", reason_other: "" }); }
    else if (newStatus === "recycled") { setShowModal("recycled"); setModalData({ reason: "", follow_up_date: "" }); }
    else if (newStatus === "submitted") { setShowModal("submitted"); setModalData({}); }
    else if (newStatus === "signed") { setShowModal("signed"); setModalData({}); }
    else if (newStatus === "qualified_prospect") { createDealAndUpdateStatus(); }
    else { updateStatus(newStatus, {}); }
  };

  const createDealAndUpdateStatus = async () => {
    setSaving(true);
    const oldStatus = lead.status;
    const existing = await supabase.from("deals").select("*").eq("lead_id", params.id).single();
    if (!existing.data) {
      const { data: newDeal } = await supabase.from("deals").insert({ lead_id: params.id as string, user_id: userId, business_legal_name: lead.business_name, dba_name: lead.business_name }).select().single();
      if (newDeal) { setDeal(newDeal); }
      await logActivity("deal_created", null, null, null, "Deal created");
    }
    await supabase.from("leads").update({ status: "qualified_prospect", updated_at: new Date().toISOString() }).eq("id", params.id);
    await logActivity("stage_change", "status", statusLabel(oldStatus), "Qualified Prospect", "Stage changed from " + statusLabel(oldStatus) + " to Qualified Prospect");
    setLead({ ...lead, status: "qualified_prospect", updated_at: new Date().toISOString() });
    setSaving(false);
  };

  const deleteDealIfExists = async () => {
    const { data: deals } = await supabase.from("deals").select("id").eq("lead_id", params.id as string);
    if (deals && deals.length > 0) {
      for (const d of deals) {
        await supabase.from("deal_documents").delete().eq("deal_id", d.id);
        await supabase.from("deal_owners").delete().eq("deal_id", d.id);
        await supabase.from("deals").delete().eq("id", d.id);
      }
      setDeal(null);
      setOwners([]);
      setDocuments([]);
      await logActivity("deal_deleted", null, null, null, "Deal removed");
    }
  };

  const deleteMerchantIfExists = async () => {
    const { data: merchants } = await supabase.from("merchants").select("id").eq("lead_id", params.id as string);
    if (merchants && merchants.length > 0) {
      for (const m of merchants) { await supabase.from("merchants").delete().eq("id", m.id); }
      await logActivity("merchant_deleted", null, null, null, "Merchant removed");
    }
  };

  const updateStatus = async (newStatus: string, extraFields: any) => {
    setSaving(true);
    const oldStatus = lead.status;
    if (newStatus !== "signed" && newStatus !== "converted") { await deleteMerchantIfExists(); }
    if (newStatus === "new_prospect" || newStatus === "contact_pending" || newStatus === "pending_qualification") { await deleteMerchantIfExists(); await deleteDealIfExists(); }
    const { error } = await supabase.from("leads").update({ status: newStatus, updated_at: new Date().toISOString(), ...extraFields }).eq("id", params.id);
    if (!error) {
      await logActivity("stage_change", "status", statusLabel(oldStatus), statusLabel(newStatus), "Stage changed from " + statusLabel(oldStatus) + " to " + statusLabel(newStatus));
      setLead({ ...lead, status: newStatus, updated_at: new Date().toISOString(), ...extraFields });
      setShowModal("");
    }
    setSaving(false);
  };

  const convertToMerchant = async () => {
    setSaving(true);
    const { data: dealData } = await supabase.from("deals").select("*").eq("lead_id", lead.id).single();
    const merchantInsert: Record<string, any> = {
      user_id: userId,
      lead_id: lead.id,
      business_name: lead.business_name,
      contact_name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      monthly_volume: lead.monthly_volume,
      status: "pending",
    };
    if (dealData) {
      const dealToMerchant: Record<string, string> = {
        dba_name: "dba_name",
        legal_street: "business_street",
        legal_city: "business_city",
        legal_state: "business_state",
        legal_zip: "business_zip",
        pricing_type: "pricing_type",
        ic_plus_visa_pct: "ic_plus_visa_pct",
        ic_plus_mc_pct: "ic_plus_mc_pct",
        ic_plus_amex_pct: "ic_plus_amex_pct",
        ic_plus_disc_pct: "ic_plus_disc_pct",
        ic_plus_visa_txn: "ic_plus_visa_txn",
        ic_plus_mc_txn: "ic_plus_mc_txn",
        ic_plus_amex_txn: "ic_plus_amex_txn",
        ic_plus_disc_txn: "ic_plus_disc_txn",
        dual_pricing_rate: "dual_pricing_rate",
        dual_pricing_txn_fee: "dual_pricing_txn_fee",
        flat_rate_pct: "flat_rate_pct",
        flat_rate_txn_cost: "flat_rate_txn_cost",
        fee_chargeback: "fee_chargeback",
        fee_retrieval: "fee_retrieval",
        fee_arbitration: "fee_arbitration",
        fee_voice_auth: "fee_voice_auth",
        fee_ebt_auth: "fee_ebt_auth",
        fee_gateway_monthly: "fee_gateway_monthly",
        fee_gateway_txn: "fee_gateway_txn",
        fee_ach_reject: "fee_ach_reject",
        monthly_fee_statement: "monthly_fee_statement",
        monthly_fee_custom_name: "monthly_fee_custom_name",
        monthly_fee_custom_amount: "monthly_fee_custom_amount",
        pci_compliance_monthly: "pci_compliance_monthly",
        pci_compliance_annual: "pci_compliance_annual",
        interchange_remittance: "interchange_remittance",
        terminal_type: "terminal_type",
        terminal_cost: "equipment_cost",
        monthly_volume: "monthly_volume",
      };
      for (const [dealField, merchantField] of Object.entries(dealToMerchant)) {
        const val = dealData[dealField];
        if (val != null && val !== "") merchantInsert[merchantField] = val;
      }
      if (dealData.free_hardware === "yes") merchantInsert.free_equipment = "yes";
      else if (dealData.free_hardware === "no") merchantInsert.free_equipment = "no";
    }
    const { data: merchant, error: merchantError } = await supabase.from("merchants").insert(merchantInsert).select().single();
    if (merchantError) { setSaving(false); return; }
    await supabase.from("leads").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", params.id);
    await logActivity("stage_change", "status", statusLabel(lead.status), "Converted", "Lead converted to merchant");
    setLead({ ...lead, status: "converted", updated_at: new Date().toISOString() });
    setShowModal("");
    setSaving(false);
    router.push("/dashboard/merchants/" + merchant.id);
  };

  const updateDealField = (field: string, value: any) => { setDeal({ ...deal, [field]: value }); };

  const formatEIN = (val: string) => {
    const nums = val.replace(/[^0-9]/g, "").slice(0, 9);
    if (nums.length > 2) return nums.slice(0, 2) + "-" + nums.slice(2);
    return nums;
  };

  const saveDeal = async () => {
    setDealSaving(true);
    const { id, created_at, lead_id, user_id, ...updates } = deal;
    updates.updated_at = new Date().toISOString();
    Object.keys(updates).forEach(key => {
      if (updates[key] === "") {
        updates[key] = null;
      }
    });
    const { error } = await supabase.from("deals").update(updates).eq("id", deal.id);
    if (error) {
      console.error("Deal save error:", JSON.stringify(error));
      setDealMsg("Error saving deal: " + error.message);
    } else {
      await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", params.id);
      setLead({ ...lead, updated_at: new Date().toISOString() });
      await logActivity("deal_updated", null, null, null, "Deal details updated");
      setDealMsg("Deal saved!");
    }
    setDealSaving(false);
    setTimeout(() => setDealMsg(""), 2000);
  };

  const addOwner = async () => {
    if (!deal) return;
    const { data } = await supabase.from("deal_owners").insert({ deal_id: deal.id, full_name: "" }).select().single();
    if (data) {
      setOwners([...owners, data]);
      await logActivity("owner_added", null, null, null, "New owner added to deal");
    }
  };

  const updateOwner = (idx: number, field: string, value: any) => {
    const updated = [...owners];
    updated[idx] = { ...updated[idx], [field]: value };
    setOwners(updated);
  };

  const saveOwners = async () => {
    for (const o of owners) {
      const { id, created_at, ...updates } = o;
      await supabase.from("deal_owners").update(updates).eq("id", id);
    }
  };

  const removeOwner = async (idx: number) => {
    const o = owners[idx];
    await supabase.from("deal_owners").delete().eq("id", o.id);
    setOwners(owners.filter((_, i) => i !== idx));
    await logActivity("owner_removed", null, o.full_name || "Unknown", null, "Owner removed: " + (o.full_name || "Unknown"));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !deal || !selectedDocType) return;
    setUploading(true);
    const file = e.target.files[0];
    const filePath = userId + "/" + deal.id + "/" + selectedDocType + "/" + Date.now() + "_" + file.name;

    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);

    const { data: docRecord } = await supabase.from("deal_documents").insert({
      deal_id: deal.id,
      doc_type: selectedDocType,
      file_name: file.name,
      file_url: urlData.publicUrl,
    }).select().single();

    if (docRecord) {
      setDocuments([...documents, docRecord]);
      await logActivity("document_uploaded", null, null, file.name, "Document uploaded: " + docTypeLabel(selectedDocType) + " - " + file.name);
    }
    setSelectedDocType("");
    setUploading(false);
    e.target.value = "";
  };

  const deleteDocument = async (doc: any) => {
    const pathParts = doc.file_url.split("/deal-documents/");
    if (pathParts[1]) {
      await supabase.storage.from("deal-documents").remove([decodeURIComponent(pathParts[1])]);
    }
    await supabase.from("deal_documents").delete().eq("id", doc.id);
    setDocuments(documents.filter(d => d.id !== doc.id));
    await logActivity("document_deleted", null, doc.file_name, null, "Document deleted: " + docTypeLabel(doc.doc_type) + " - " + doc.file_name);
  };

  const updateLeadField = (field: string, value: any) => { setLead({ ...lead, [field]: value }); };

  const saveContactInfo = async () => {
    if (!lead) return;
    setContactSaving(true);
    setContactMsg("");
    const updates: Record<string, any> = {
      business_name: lead.business_name,
      contact_name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      website: lead.website,
      monthly_volume: lead.monthly_volume,
      notes: lead.notes,
      updated_at: new Date().toISOString(),
    };
    Object.keys(updates).forEach(key => {
      if (updates[key] === "") { updates[key] = null; }
    });
    const { error } = await supabase.from("leads").update(updates).eq("id", lead.id);
    if (error) {
      setContactMsg("Error: " + error.message);
    } else {
      setContactMsg("Contact info saved!");
      await logActivity("lead_updated", null, null, null, "Contact info updated");
    }
    setTimeout(() => setContactMsg(""), 3000);
    setContactSaving(false);
  };

  const inputClass = "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-base";
  const labelClass = "text-base text-slate-500 block mb-1";
  const sectionClass = "bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6";

  if (authLoading || loading) return <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8">Loading...</div>;

  if (permissionDenied) return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />
      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-500 mb-6">You don't have permission to view this lead.</p>
          <Link href="/dashboard/leads" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Back to Leads</Link>
        </div>
      </div>
    </div>
  );
  if (!lead) return <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8">Lead not found</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <Link href="/dashboard/leads" className="text-slate-400 hover:text-slate-900 text-sm transition">← Back to Leads</Link>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mt-4 mb-4 gap-3">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">{lead.business_name}</h2>
            <p className="text-slate-500 mt-1">{lead.contact_name}</p>
            {lead.updated_at && <p className="text-slate-400 text-xs mt-1">Last modified: {new Date(lead.updated_at).toLocaleString()}</p>}
          </div>
          <div className="sm:text-right">
            <label className="text-base font-bold text-slate-900 block mb-2 sm:text-center">Stage</label>
            {canChangeStage ? (
              <select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer text-slate-900">
                {statuses.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            ) : (
              <span className="px-4 py-2 rounded-full text-sm font-medium bg-slate-100 text-slate-600">{statusLabel(lead.status)}</span>
            )}
          </div>
        </div>

        {lead.status === "converted" && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm mb-6">This lead has been converted to a merchant account.</div>
        )}

        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Contact Info</h3>
            <div className="flex items-center gap-3">
              {contactMsg && <span className={`text-sm ${contactMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{contactMsg}</span>}
              {canEdit && <button onClick={saveContactInfo} disabled={contactSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{contactSaving ? "Saving..." : "Save Contact Info"}</button>}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Business Name</label>
                <input type="text" value={lead.business_name || ""} onChange={(e) => updateLeadField("business_name", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact Name</label>
                <input type="text" value={lead.contact_name || ""} onChange={(e) => updateLeadField("contact_name", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={lead.email || ""} onChange={(e) => updateLeadField("email", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="text" value={lead.phone || ""} onChange={(e) => updateLeadField("phone", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">Website</a> : "Website"}</label>
                <input type="text" value={lead.website || ""} onChange={(e) => updateLeadField("website", e.target.value)} className={inputClass} placeholder="https://example.com" />
              </div>
              <div>
                <label className={labelClass}>Monthly Volume ($)</label>
                <input type="number" step="0.01" value={lead.monthly_volume ?? ""} onChange={(e) => updateLeadField("monthly_volume", e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Created</label>
                <p className="text-sm text-slate-600 mt-1">{new Date(lead.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={lead.notes || ""} onChange={(e) => updateLeadField("notes", e.target.value)} className={inputClass + " h-20 resize-none"} rows={3} />
            </div>
            {(lead.follow_up_date || lead.unqualified_reason || lead.recycled_reason) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-sm">
                {lead.follow_up_date && <div><span className="text-slate-500">Follow Up:</span> <span className="ml-2">{lead.follow_up_date}</span></div>}
                {lead.unqualified_reason && <div><span className="text-slate-500">Unqualified Reason:</span> <span className="ml-2">{lead.unqualified_reason}{lead.unqualified_reason_other ? " - " + lead.unqualified_reason_other : ""}</span></div>}
                {lead.recycled_reason && <div><span className="text-slate-500">Recycled Reason:</span> <span className="ml-2">{lead.recycled_reason}</span></div>}
              </div>
            )}
          </div>
        </div>

        {/* Communication Log */}
        <CommunicationLog
          leadId={lead.id}
          dealId={deal?.id}
          contactName={lead.contact_name}
          contactPhone={lead.phone}
          contactEmail={lead.email}
          onTaskCreated={fetchTasks}
        />

        {/* Task Toast */}
        {taskToast && (
          <p className="text-emerald-600 text-sm font-medium mb-2">✅ Follow-up created</p>
        )}

        {/* Upcoming Tasks */}
        {leadTasks.length > 0 && (() => {
          const today = new Date().toISOString().split("T")[0];
          const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
          const priorityDot: Record<string, string> = { low: "bg-slate-300", medium: "bg-blue-400", high: "bg-amber-400", urgent: "bg-red-500" };
          const dueLabel = (d: string | null) => {
            if (!d) return null;
            if (d < today) return <span className="text-xs text-red-500 font-medium ml-auto">Overdue</span>;
            if (d === today) return <span className="text-xs text-emerald-600 ml-auto">Today</span>;
            if (d === tomorrow) return <span className="text-xs text-blue-600 ml-auto">Tomorrow</span>;
            return <span className="text-xs text-slate-400 ml-auto">{new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
          };
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <span className="text-base font-semibold text-slate-900">Upcoming Tasks</span>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full ml-2">{leadTasks.length}</span>
                </div>
                <button onClick={() => setShowTaskModal(true)} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">+ Add</button>
              </div>
              <div>
                {leadTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 py-2 ${i < leadTasks.length - 1 ? "border-b border-slate-50" : ""} transition-opacity duration-300 ${fadingTaskIds.has(task.id) ? "opacity-0" : "opacity-100"}`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-emerald-600"
                      onChange={async () => {
                        setFadingTaskIds(prev => new Set(prev).add(task.id));
                        await supabase.from("tasks").update({ status: "completed" }).eq("id", task.id);
                        if (userId) {
                          supabase.from("activity_log").insert({ user_id: userId, lead_id: lead.id, deal_id: deal?.id || null, action_type: "task_completed", description: `Task completed: ${task.title}` });
                        }
                        setTimeout(() => setLeadTasks(prev => prev.filter(t => t.id !== task.id)), 300);
                      }}
                    />
                    <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[task.priority] || "bg-slate-300"}`} />
                    <span className="text-xs font-medium text-slate-700 flex-1 truncate">{task.title}</span>
                    {dueLabel(task.due_date)}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            onClose={() => setShowTaskModal(false)}
            onSaved={fetchTasks}
            leadId={lead.id}
            dealId={deal?.id}
            linkedEntityName={lead.business_name}
          />
        )}

        {deal && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">Deal Details</h3>
                {deal.updated_at && <p className="text-slate-400 text-xs mt-1">Deal last modified: {new Date(deal.updated_at).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-3">
                {dealMsg && <span className="text-emerald-600 text-sm">{dealMsg}</span>}
                {canEdit && <button onClick={async () => { await saveDeal(); await saveOwners(); }} disabled={dealSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{dealSaving ? "Saving..." : "Save Deal"}</button>}
              </div>
            </div>

            {/* GROUP 1 - Business & Transaction Info */}
            <div onClick={() => toggleGroup("group1")} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.group1 ? "border-l-4 border-l-emerald-500" : ""}`}>
              <h3 className="text-lg font-semibold text-slate-700">Business & Transaction Info</h3>
              <span className={`text-slate-400 transition-transform duration-200 ${openGroups.group1 ? "rotate-180" : ""}`}>▼</span>
            </div>
            <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.group1 ? "5000px" : "0px", opacity: openGroups.group1 ? 1 : 0 }}>
              <div className="space-y-6 mb-6">
                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Business Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Business Legal Name</label><input type="text" value={deal.business_legal_name || ""} onChange={(e) => updateDealField("business_legal_name", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>DBA Name</label><input type="text" value={deal.dba_name || ""} onChange={(e) => updateDealField("dba_name", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div><label className={labelClass}>Street</label><input type="text" value={deal.legal_street || ""} onChange={(e) => updateDealField("legal_street", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>City</label><input type="text" value={deal.legal_city || ""} onChange={(e) => updateDealField("legal_city", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>State</label><input type="text" value={deal.legal_state || ""} onChange={(e) => updateDealField("legal_state", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Zip</label><input type="text" value={deal.legal_zip || ""} onChange={(e) => updateDealField("legal_zip", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Entity & EIN</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Entity Type</label>
                      <select value={deal.entity_type || ""} onChange={(e) => updateDealField("entity_type", e.target.value)} className={inputClass}>
                        <option value="">Select...</option>
                        <option value="sole_prop">Sole Proprietorship</option>
                        <option value="llc">LLC</option>
                        <option value="corp">Corporation</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    </div>
                    <div><label className={labelClass}>EIN/ITIN</label><input type="text" value={deal.ein_itin || ""} onChange={(e) => updateDealField("ein_itin", formatEIN(e.target.value))} className={inputClass} placeholder="XX-XXXXXXX" maxLength={10} /></div>
                  </div>
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Transaction Info</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div><label className={labelClass}>Card Environment</label><select value={deal.card_environment || ""} onChange={(e) => updateDealField("card_environment", e.target.value)} className={inputClass}><option value="">Select...</option><option value="cp">Card Present</option><option value="cnp">Card Not Present</option><option value="both">Both</option></select></div>
                    {(deal.card_environment === "both") && (
                      <>
                        <div><label className={labelClass}>CP %</label><input type="number" value={deal.cp_pct || ""} onChange={(e) => { updateDealField("cp_pct", e.target.value); updateDealField("cnp_pct", e.target.value ? String(100 - Number(e.target.value)) : ""); }} className={inputClass} /></div>
                        <div><label className={labelClass}>CNP %</label><input type="number" value={deal.cnp_pct || ""} onChange={(e) => { updateDealField("cnp_pct", e.target.value); updateDealField("cp_pct", e.target.value ? String(100 - Number(e.target.value)) : ""); }} className={inputClass} /></div>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div><label className={labelClass}>Currently Takes Cards?</label><select value={deal.currently_takes_cards || ""} onChange={(e) => updateDealField("currently_takes_cards", e.target.value)} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    <div><label className={labelClass}>Monthly Volume</label><input type="number" value={deal.monthly_volume || ""} onChange={(e) => updateDealField("monthly_volume", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Average Ticket</label><input type="number" step="0.01" value={deal.average_ticket || ""} onChange={(e) => updateDealField("average_ticket", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div><label className={labelClass}>High Ticket</label><input type="number" step="0.01" value={deal.high_ticket || ""} onChange={(e) => updateDealField("high_ticket", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Amex Volume</label><input type="number" value={deal.amex_volume || ""} onChange={(e) => updateDealField("amex_volume", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Amex ESA #</label><input type="text" value={deal.amex_esa || ""} onChange={(e) => updateDealField("amex_esa", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div><label className={labelClass}>Pin Debit</label><select value={deal.pin_debit || ""} onChange={(e) => updateDealField("pin_debit", e.target.value)} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    <div><label className={labelClass}>EBT</label><select value={deal.ebt || ""} onChange={(e) => updateDealField("ebt", e.target.value)} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    <div><label className={labelClass}>Funding Type</label><select value={deal.funding_type || ""} onChange={(e) => updateDealField("funding_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="next_day">Next Day</option><option value="same_day">Same Day</option></select></div>
                  </div>
                </div>
              </div>
            </div>

            {/* GROUP 2 - Ownership, Banking & Compliance */}
            <div onClick={() => toggleGroup("group2")} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.group2 ? "border-l-4 border-l-emerald-500" : ""}`}>
              <h3 className="text-lg font-semibold text-slate-700">Ownership, Banking & Compliance<span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full ml-2">{owners.length}</span><span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full ml-1">{documents.length} docs</span></h3>
              <span className={`text-slate-400 transition-transform duration-200 ${openGroups.group2 ? "rotate-180" : ""}`}>▼</span>
            </div>
            <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.group2 ? "5000px" : "0px", opacity: openGroups.group2 ? 1 : 0 }}>
              <div className="space-y-6 mb-6">
                <div className={sectionClass}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-emerald-600">Ownership</h4>
                    <button onClick={addOwner} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs transition">+ Add Owner</button>
                  </div>
                  {owners.length === 0 && <p className="text-slate-500 text-sm">No owners added yet.</p>}
                  {owners.map((o, idx) => (
                    <div key={o.id} className="border border-slate-200 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium">Owner {idx + 1}</span>
                        <button onClick={() => removeOwner(idx)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                        <div><label className={labelClass}>Full Name</label><input type="text" value={o.full_name || ""} onChange={(e) => updateOwner(idx, "full_name", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Title</label><input type="text" value={o.title || ""} onChange={(e) => updateOwner(idx, "title", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Ownership %</label><input type="number" value={o.ownership_pct || ""} onChange={(e) => updateOwner(idx, "ownership_pct", e.target.value)} className={inputClass} /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                        <div><label className={labelClass}>DOB</label><input type="date" value={o.dob || ""} onChange={(e) => updateOwner(idx, "dob", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>SSN</label><input type="password" value={o.ssn || ""} onChange={(e) => updateOwner(idx, "ssn", e.target.value)} className={inputClass} placeholder="###-##-####" /></div>
                        <div><label className={labelClass}>Phone</label><input type="tel" value={o.phone || ""} onChange={(e) => updateOwner(idx, "phone", e.target.value)} className={inputClass} /></div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div><label className={labelClass}>Address</label><input type="text" value={o.address || ""} onChange={(e) => updateOwner(idx, "address", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>City</label><input type="text" value={o.city || ""} onChange={(e) => updateOwner(idx, "city", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>State</label><input type="text" value={o.state || ""} onChange={(e) => updateOwner(idx, "state", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Zip</label><input type="text" value={o.zip || ""} onChange={(e) => updateOwner(idx, "zip", e.target.value)} className={inputClass} /></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Banking Info</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label className={labelClass}>Routing Number</label><input type="text" value={deal.bank_routing || ""} onChange={(e) => updateDealField("bank_routing", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Account Number</label><input type="text" value={deal.bank_account || ""} onChange={(e) => updateDealField("bank_account", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Account Type</label><select value={deal.bank_account_type || ""} onChange={(e) => updateDealField("bank_account_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="checking">Checking</option><option value="savings">Savings</option></select></div>
                  </div>
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Documents</h4>
                  <div className="flex gap-4 mb-4 items-end">
                    <div className="flex-1">
                      <label className={labelClass}>Document Type</label>
                      <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value)} className={inputClass}>
                        <option value="">Select document type...</option>
                        {docTypes.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={`${selectedDocType ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer" : "bg-slate-100 cursor-not-allowed opacity-50"} text-white px-4 py-2 rounded-lg text-sm font-medium transition inline-block`}>
                        {uploading ? "Uploading..." : "Upload File"}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={!selectedDocType || uploading} />
                      </label>
                    </div>
                  </div>

                  {documents.length === 0 ? (
                    <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-slate-100 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-600 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded">{docTypeLabel(doc.doc_type)}</span>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 hover:text-slate-900 transition">{doc.file_name}</a>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-xs">{new Date(doc.created_at).toLocaleDateString()}</span>
                            <button onClick={() => deleteDocument(doc)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Compliance</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Processing Account Ever Terminated?</label><select value={deal.processing_terminated || ""} onChange={(e) => updateDealField("processing_terminated", e.target.value)} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    <div><label className={labelClass}>Filed for Bankruptcy?</label><select value={deal.filed_bankruptcy || ""} onChange={(e) => updateDealField("filed_bankruptcy", e.target.value)} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                  </div>
                </div>
              </div>
            </div>

            {/* GROUP 3 - Pricing, Hardware & Residuals */}
            <div onClick={() => toggleGroup("group3")} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.group3 ? "border-l-4 border-l-emerald-500" : ""}`}>
              <h3 className="text-lg font-semibold text-slate-700">Pricing, Hardware & Residuals</h3>
              <span className={`text-slate-400 transition-transform duration-200 ${openGroups.group3 ? "rotate-180" : ""}`}>▼</span>
            </div>
            <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.group3 ? "5000px" : "0px", opacity: openGroups.group3 ? 1 : 0 }}>
              <div className="space-y-6 mb-6">
                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Pricing</h4>
                  <div className="mb-4">
                    <label className={labelClass}>Pricing Type</label>
                    <select value={deal.pricing_type || ""} onChange={(e) => updateDealField("pricing_type", e.target.value)} className={inputClass}>
                      <option value="">Select pricing type...</option>
                      <option value="interchange_plus">Interchange Plus</option>
                      <option value="dual_pricing">Dual Pricing</option>
                      <option value="surcharging">Surcharging</option>
                      <option value="tiered">Tiered</option>
                      <option value="flat_rate">Flat Rate</option>
                    </select>
                  </div>

                  {deal.pricing_type === "interchange_plus" && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Percentage Markups (%)</p>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div><label className={labelClass}>Visa %</label><input type="number" step="0.01" value={deal.ic_plus_visa_pct || ""} onChange={(e) => updateDealField("ic_plus_visa_pct", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>MC %</label><input type="number" step="0.01" value={deal.ic_plus_mc_pct || ""} onChange={(e) => updateDealField("ic_plus_mc_pct", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>AMEX %</label><input type="number" step="0.01" value={deal.ic_plus_amex_pct || ""} onChange={(e) => updateDealField("ic_plus_amex_pct", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Disc %</label><input type="number" step="0.01" value={deal.ic_plus_disc_pct || ""} onChange={(e) => updateDealField("ic_plus_disc_pct", e.target.value)} className={inputClass} /></div>
                      </div>
                      <p className="text-sm text-slate-500 mb-2">Per Transaction ($)</p>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div><label className={labelClass}>Visa $</label><input type="number" step="0.01" value={deal.ic_plus_visa_txn || ""} onChange={(e) => updateDealField("ic_plus_visa_txn", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>MC $</label><input type="number" step="0.01" value={deal.ic_plus_mc_txn || ""} onChange={(e) => updateDealField("ic_plus_mc_txn", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>AMEX $</label><input type="number" step="0.01" value={deal.ic_plus_amex_txn || ""} onChange={(e) => updateDealField("ic_plus_amex_txn", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Disc $</label><input type="number" step="0.01" value={deal.ic_plus_disc_txn || ""} onChange={(e) => updateDealField("ic_plus_disc_txn", e.target.value)} className={inputClass} /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Interchange Remittance</label><select value={deal.interchange_remittance || ""} onChange={(e) => updateDealField("interchange_remittance", e.target.value)} className={inputClass}><option value="">Select...</option><option value="daily">Daily</option><option value="monthly">Monthly</option></select></div>
                      </div>
                    </div>
                  )}

                  {deal.pricing_type === "dual_pricing" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className={labelClass}>Dual Pricing Rate (%)</label><input type="number" step="0.01" value={deal.dual_pricing_rate || ""} onChange={(e) => updateDealField("dual_pricing_rate", e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Per Transaction Fee ($)</label><input type="number" step="0.01" value={deal.dual_pricing_txn_fee || ""} onChange={(e) => updateDealField("dual_pricing_txn_fee", e.target.value)} className={inputClass} /></div>
                    </div>
                  )}

                  {deal.pricing_type === "flat_rate" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className={labelClass}>Flat Rate (%)</label><input type="number" step="0.01" value={deal.flat_rate_pct || ""} onChange={(e) => updateDealField("flat_rate_pct", e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Per Transaction ($)</label><input type="number" step="0.01" value={deal.flat_rate_txn_cost || ""} onChange={(e) => updateDealField("flat_rate_txn_cost", e.target.value)} className={inputClass} /></div>
                    </div>
                  )}

                  {deal.pricing_type === "tiered" && (
                    <div className="bg-slate-100 rounded-lg p-4"><p className="text-slate-500 text-sm">Tiered pricing configuration coming soon.</p></div>
                  )}
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Misc Fees ($)</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div><label className={labelClass}>Chargebacks</label><input type="number" step="0.01" value={deal.fee_chargeback || ""} onChange={(e) => updateDealField("fee_chargeback", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Retrievals</label><input type="number" step="0.01" value={deal.fee_retrieval || ""} onChange={(e) => updateDealField("fee_retrieval", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Arbitration</label><input type="number" step="0.01" value={deal.fee_arbitration || ""} onChange={(e) => updateDealField("fee_arbitration", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Voice Auths</label><input type="number" step="0.01" value={deal.fee_voice_auth || ""} onChange={(e) => updateDealField("fee_voice_auth", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>EBT Auths</label><input type="number" step="0.01" value={deal.fee_ebt_auth || ""} onChange={(e) => updateDealField("fee_ebt_auth", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Gateway Monthly</label><input type="number" step="0.01" value={deal.fee_gateway_monthly || ""} onChange={(e) => updateDealField("fee_gateway_monthly", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Gateway Per Txn</label><input type="number" step="0.01" value={deal.fee_gateway_txn || ""} onChange={(e) => updateDealField("fee_gateway_txn", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>ACH Reject</label><input type="number" step="0.01" value={deal.fee_ach_reject || ""} onChange={(e) => updateDealField("fee_ach_reject", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Monthly Fees</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div><label className={labelClass}>Statement Fee</label><input type="number" step="0.01" value={deal.monthly_fee_statement || ""} onChange={(e) => updateDealField("monthly_fee_statement", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Custom Fee Name</label><input type="text" value={deal.monthly_fee_custom_name || ""} onChange={(e) => updateDealField("monthly_fee_custom_name", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Custom Fee Amount</label><input type="number" step="0.01" value={deal.monthly_fee_custom_amount || ""} onChange={(e) => updateDealField("monthly_fee_custom_amount", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div><label className={labelClass}>PCI Compliance Monthly</label><input type="number" step="0.01" value={deal.pci_compliance_monthly || ""} onChange={(e) => updateDealField("pci_compliance_monthly", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>PCI Compliance Annual</label><input type="number" step="0.01" value={deal.pci_compliance_annual || ""} onChange={(e) => updateDealField("pci_compliance_annual", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Hardware & Software</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div><label className={labelClass}>Terminal Type</label><select value={deal.terminal_type || ""} onChange={(e) => updateDealField("terminal_type", e.target.value)} className={inputClass}><option value="">Select...</option><option value="dejavoo">Dejavoo</option><option value="pax">Pax</option></select></div>
                    <div><label className={labelClass}>Terminal Cost ($)</label><input type="number" step="0.01" value={deal.terminal_cost || ""} onChange={(e) => updateDealField("terminal_cost", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label className={labelClass}>Free Hardware?</label><select value={deal.free_hardware || ""} onChange={(e) => updateDealField("free_hardware", e.target.value)} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    <div><label className={labelClass}>Gateway Name</label><input type="text" value={deal.gateway_name || ""} onChange={(e) => updateDealField("gateway_name", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Gateway API</label><input type="text" value={deal.gateway_api || ""} onChange={(e) => updateDealField("gateway_api", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Residuals & Rep Codes</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Rep Codes / Schedule Applied</label><input type="text" value={deal.rep_codes || ""} onChange={(e) => updateDealField("rep_codes", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Forecasted Residuals</label><input type="number" step="0.01" value={deal.forecasted_residuals || ""} onChange={(e) => updateDealField("forecasted_residuals", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Last Month Residual Actuals</label><input type="number" step="0.01" value={deal.last_month_residual_actuals || ""} onChange={(e) => updateDealField("last_month_residual_actuals", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Average Residual</label><input type="number" step="0.01" value={deal.average_residual || ""} onChange={(e) => updateDealField("average_residual", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end mb-8">
                <button onClick={async () => { await saveDeal(); await saveOwners(); }} disabled={dealSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50">{dealSaving ? "Saving..." : "Save Deal"}</button>
              </div>
            )}
          </>
        )}

        <div onClick={() => toggleGroup("activityLog")} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.activityLog ? "border-l-4 border-l-emerald-500" : ""}`}>
          <h3 className="text-lg font-semibold text-slate-700">Activity Log<span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full ml-2">{activities.length}</span></h3>
          <span className={`text-slate-400 transition-transform duration-200 ${openGroups.activityLog ? "rotate-180" : ""}`}>▼</span>
        </div>
        <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.activityLog ? "5000px" : "0px", opacity: openGroups.activityLog ? 1 : 0 }}>
          <div className={sectionClass}>
            {activities.length === 0 ? (
              <p className="text-slate-500 text-sm">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-slate-600">{a.description}</p>
                      <p className="text-slate-400 text-xs">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal === "unqualified" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Mark as Unqualified</h3>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-500 block mb-1">Reason</label><select value={modalData.reason} onChange={(e) => setModalData({ ...modalData, reason: e.target.value })} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"><option value="">Select a reason...</option>{unqualifiedReasons.map((r) => (<option key={r} value={r}>{r}</option>))}</select></div>
              {modalData.reason === "Other" && (<div><label className="text-sm text-slate-500 block mb-1">Please specify</label><input type="text" value={modalData.reason_other} onChange={(e) => setModalData({ ...modalData, reason_other: e.target.value })} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Enter reason..." /></div>)}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button onClick={() => updateStatus("unqualified", { unqualified_reason: modalData.reason, unqualified_reason_other: modalData.reason_other })} disabled={!modalData.reason || saving} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Saving..." : "Confirm"}</button>
                <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal === "recycled" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Recycle Lead</h3>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-500 block mb-1">Reason for recycling</label><input type="text" value={modalData.reason} onChange={(e) => setModalData({ ...modalData, reason: e.target.value })} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="e.g. Price objection, timing not right..." /></div>
              <div><label className="text-sm text-slate-500 block mb-1">Follow-up date</label><input type="date" value={modalData.follow_up_date} onChange={(e) => setModalData({ ...modalData, follow_up_date: e.target.value })} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" /></div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button onClick={() => updateStatus("recycled", { recycled_reason: modalData.reason, follow_up_date: modalData.follow_up_date })} disabled={!modalData.reason || !modalData.follow_up_date || saving} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Saving..." : "Confirm"}</button>
                <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal === "submitted" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Submit Application</h3>
            <p className="text-slate-500 text-sm mb-4">Moving to Submitted requires application info. This will open the application form for this lead.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={() => updateStatus("submitted", {})} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition">Continue to Application</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "signed" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Application Signed</h3>
            <p className="text-slate-500 text-sm mb-4">This will mark the application as signed and automatically create a new merchant account with this lead's information.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={convertToMerchant} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Creating..." : "Confirm & Create Merchant"}</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
