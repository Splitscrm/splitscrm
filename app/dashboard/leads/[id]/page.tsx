"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import CommunicationLog, { type CommunicationLogHandle } from "@/components/CommunicationLog";
import TaskModal from "@/components/TaskModal";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";
import { authFetch } from "@/lib/api-client";
import { getSignedUrl, extractStoragePath } from "@/lib/storage";
import { checkMpaCompleteness, getTabStatus, type MpaCompletenessResult } from "@/lib/mpa-completeness";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

// Valid DB columns for deals table — filter updates to prevent 400 errors from non-existent columns
const VALID_DEAL_COLUMNS = new Set([
  "business_legal_name", "business_start_date", "cnp_pct", "cp_pct", "dba_name",
  "dual_pricing_rate", "dual_pricing_txn_fee", "entity_type", "fee_ach_reject", "fee_arbitration",
  "fee_chargeback", "fee_ebt_auth", "fee_gateway_monthly", "fee_gateway_txn", "fee_retrieval",
  "fee_voice_auth", "flat_rate_pct", "flat_rate_txn_cost", "free_hardware", "gateway_api",
  "gateway_name", "hardware_items", "hardware_model", "high_ticket", "ic_plus_amex_pct",
  "ic_plus_amex_txn", "ic_plus_disc_pct", "ic_plus_disc_txn", "ic_plus_mc_pct", "ic_plus_mc_txn",
  "ic_plus_visa_pct", "ic_plus_visa_txn", "interchange_remittance", "is_primary_location",
  "legal_city", "legal_state", "legal_street", "legal_zip", "location_city", "location_name",
  "location_state", "location_street", "location_zip", "mcc_code", "monthly_fee_custom_amount",
  "monthly_fee_custom_name", "monthly_fee_statement", "monthly_volume", "partner_id",
  "pci_compliance_annual", "pci_compliance_monthly", "pct_b2b", "pct_internet", "pct_mail_order",
  "pct_telephone_order", "pricing_type", "reason_for_leaving", "seasonal_business", "seasonal_months",
  "sic_code", "software_items", "terminal_cost", "terminal_type", "three_d_secure_enabled",
  "updated_at", "average_ticket", "business_phone", "business_email", "funding_type", "notes",
  "bank_routing", "bank_account", "annual_revenue", "number_of_employees", "sponsor_bank",
  "customer_service_phone", "ein_itin", "state_of_incorporation", "currently_takes_cards",
  "amex_volume", "amex_esa", "pin_debit", "ebt", "current_mid", "monthly_transactions",
  "annual_card_volume", "amex_se_number", "discover_mid", "international_cards_pct",
  "recurring_billing", "recurring_frequency", "fulfillment_timeframe_days", "delivery_method",
  "refund_policy_text", "bank_account_type", "bank_phone", "bank_account_holder_name",
  "processing_terminated", "filed_bankruptcy", "pci_compliance_status", "pci_compliance_vendor",
  "beneficial_ownership_certified", "ach_debit_authorized", "ssl_certificate",
  "shopping_cart_platform", "stores_card_data", "negative_option_billing",
  "mpa_extra_field_values", "business_license_number", "mailing_street", "mailing_city",
  "mailing_state", "mailing_zip", "products_services_description", "org_id",
]);

// Valid DB columns for deal_owners table
const VALID_OWNER_COLUMNS = new Set([
  "full_name", "title", "ownership_pct", "dob", "phone", "address", "city", "state", "zip",
  "ssn_encrypted", "encryption_version", "email", "dl_state", "dl_expiration",
  "citizenship", "is_us_resident", "is_control_prong",
  "personal_guarantee", "prior_bankruptcies", "criminal_history", "match_tmf_listed",
  "ssn", "deal_id", "lead_id",
]);

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
  const [deals, setDeals] = useState<any[]>([]);
  const [activeDealIdx, setActiveDealIdx] = useState(0);
  const deal = deals[activeDealIdx] || null;
  const setDeal = (d: any) => setDeals(prev => {
    const next = [...prev];
    next[activeDealIdx] = typeof d === 'function' ? d(prev[activeDealIdx]) : d;
    return next;
  });
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [copyFromDealId, setCopyFromDealId] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ group1: true, group2: false, group3: false, groupEcom: false, activityLog: false });
  const [leadTab, setLeadTab] = useState("Overview");
  const [revealedSsns, setRevealedSsns] = useState<Record<number, string>>({});
  const [revealingIdx, setRevealingIdx] = useState<number | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementUploading, setStatementUploading] = useState(false);
  const [uploadedStatements, setUploadedStatements] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<any[]>([]);
  // Partner switch modal removed — simplified pricing
  const dealCreationGuard = useRef(false);
  const commLogRef = useRef<CommunicationLogHandle>(null);
  const [showCommPanel, setShowCommPanel] = useState(false);
  const [commCount, setCommCount] = useState(0);
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<any>(null);
  const [deletingLocation, setDeletingLocation] = useState(false);
  const [agentRepCodes, setAgentRepCodes] = useState<any[]>([]);
  const [repCodePartners, setRepCodePartners] = useState<Record<string, string>>({});
  const ensureDealGuard = useRef(false);
  const [pricingTemplates, setPricingTemplates] = useState<any[]>([]);
  const [showApplyConfirm, setShowApplyConfirm] = useState<any>(null);
  const [showSaveAsTpl, setShowSaveAsTpl] = useState(false);
  const [saveTplName, setSaveTplName] = useState('');
  const [saveTplDefault, setSaveTplDefault] = useState(false);
  const [saveTplSaving, setSaveTplSaving] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState('');
  const [showBelowCostWarning, setShowBelowCostWarning] = useState(false);
  const [belowCostItems, setBelowCostItems] = useState<{ label: string; sell: number; buy: number }[]>([]);
  const [pendingStageAfterWarning, setPendingStageAfterWarning] = useState("");

  // Signature flow state
  const [sigBanks, setSigBanks] = useState<any[]>([]);
  const [sigTemplate, setSigTemplate] = useState<any>(null);
  const [sigPartnerSelections, setSigPartnerSelections] = useState<Record<string, { bank: string; banks: any[]; template: any }>>({});
  const [sigSessions, setSigSessions] = useState<Record<string, any[]>>({});
  const [sigSignerName, setSigSignerName] = useState("");
  const [sigSignerEmail, setSigSignerEmail] = useState("");
  const [sigExpiry, setSigExpiry] = useState("7");
  const [sigSending, setSigSending] = useState(false);
  const [sigCopied, setSigCopied] = useState<string | null>(null);
  const [sigHistoryOpen, setSigHistoryOpen] = useState(false);
  const [sigSnapshotWarning, setSigSnapshotWarning] = useState<{ changes: string[]; originalSession: any } | null>(null);
  const [signedDocs, setSignedDocs] = useState<any[]>([]);
  const [signedDocUrls, setSignedDocUrls] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const docTypes = [
    { value: "processing_statement", label: "Processing Statement" },
    { value: "voided_check", label: "Voided Check" },
    { value: "government_id", label: "Government ID" },
    { value: "bank_letter", label: "Bank Letter" },
    { value: "business_license", label: "Business License" },
    { value: "tax_documents", label: "Tax Documents (EIN Letter)" },
    { value: "signed_mpa", label: "Signed MPA" },
    { value: "other", label: "Other" },
  ];

  const statuses = [
    { value: "new_prospect", label: "New Prospect" },
    { value: "contact_pending", label: "Contact Pending" },
    { value: "pending_qualification", label: "Pending Qualification" },
    { value: "qualified_prospect", label: "Qualified Prospect" },
    { value: "send_for_signature", label: "Send for Signature" },
    { value: "signed", label: "Signed" },
    { value: "submitted", label: "Submitted" },
    { value: "converted", label: "Converted" },
    { value: "declined", label: "Declined" },
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
      const { data: leadData } = await supabase.from("leads").select("id, assigned_to, user_id, status, business_name, contact_name, email, phone, website, monthly_volume, notes, created_at, updated_at, follow_up_date, unqualified_reason, unqualified_reason_other, recycled_reason, declined_reason").eq("id", params.id).single();
      if (leadData) {
        // Permission check: non-owner/manager can only see their own leads
        if (!isOwnerOrManager && leadData.assigned_to !== user.id && leadData.user_id !== user.id) {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        setLead(leadData);
        // Auto-switch to DealInfo tab for stages that have deal-specific UI
        if (["send_for_signature", "signed", "submitted"].includes(leadData.status)) {
          setLeadTab("DealInfo");
        }
        const { data: allDeals } = await supabase.from("deals").select("*").eq("lead_id", leadData.id).order("created_at");
        if (allDeals && allDeals.length > 0) {
          // Migrate legacy hardware/software fields on each deal
          for (const d of allDeals) {
            if (!d.hardware_items && (d.terminal_type || d.hardware_model || d.preferred_model)) {
              d.hardware_items = [{ type: d.terminal_type || "", model: d.preferred_model || d.hardware_model || "", quantity: d.hardware_quantity || 1, cost: d.terminal_cost || "", free: d.free_hardware || "" }];
            }
            if (!d.software_items && (d.gateway_name || d.gateway_api)) {
              d.software_items = [{ name: d.gateway_name || "", type: "gateway", monthly_cost: d.fee_gateway_monthly || "", per_txn: d.fee_gateway_txn || "" }];
            }
          }
          setDeals(allDeals);
          setActiveDealIdx(0);
          // Owners are shared at lead level — query by lead_id first, fall back to deal_id
          let ownerData: any[] | null = null;
          const { data: leadOwners } = await supabase.from("deal_owners").select("id, full_name, title, ownership_pct, dob, phone, address, city, state, zip, ssn_encrypted, created_at, email, dl_state, dl_expiration, citizenship, is_us_resident, is_control_prong, personal_guarantee, prior_bankruptcies, criminal_history, match_tmf_listed").eq("lead_id", leadData.id).order("created_at");
          if (leadOwners && leadOwners.length > 0) {
            ownerData = leadOwners;
          } else {
            const { data: dealOwners } = await supabase.from("deal_owners").select("id, full_name, title, ownership_pct, dob, phone, address, city, state, zip, ssn_encrypted, created_at, email, dl_state, dl_expiration, citizenship, is_us_resident, is_control_prong, personal_guarantee, prior_bankruptcies, criminal_history, match_tmf_listed").eq("deal_id", allDeals[0].id).order("created_at");
            ownerData = dealOwners;
          }
          if (ownerData) setOwners(ownerData);
          // Documents from the active deal
          const { data: docData } = await supabase.from("deal_documents").select("id, file_url, file_name, doc_type, created_at").eq("deal_id", allDeals[0].id).order("created_at");
          if (docData) {
            setDocuments(docData);
            const urls: Record<string, string> = {};
            await Promise.all(docData.map(async (doc: any) => {
              if (doc.file_url) { const signed = await getSignedUrl(doc.file_url); if (signed) urls[doc.id] = signed; }
            }));
            setSignedUrls(urls);
          }
        }
        const { data: actData } = await supabase.from("activity_log").select("id, description, created_at").eq("lead_id", leadData.id).order("created_at", { ascending: false }).limit(50);
        // Get communication count for badge
        const { count: cCount } = await supabase.from("communications").select("*", { count: "exact", head: true }).eq("lead_id", leadData.id);
        setCommCount(cCount || 0);
        if (actData) setActivities(actData);
        const { data: taskData } = await supabase.from("tasks").select("id, title, due_date, priority, status").eq("lead_id", leadData.id).eq("status", "pending").order("due_date", { ascending: true });
        if (taskData) setLeadTasks(taskData);
        // Fetch partners for partner pricing dropdown
        const { data: partnerData } = await supabase.from("partners").select("id, name, pricing_data").eq("status", "active").order("name");
        if (partnerData) setPartners(partnerData);
        // Fetch pricing templates for template selector
        if (member?.org_id) {
          const { data: ptData, error: ptErr } = await supabase.from("pricing_templates").select("*").eq("org_id", member.org_id).order("is_default", { ascending: false }).order("name");
          if (ptErr) console.error("Pricing templates query error:", ptErr);
          if (ptData) setPricingTemplates(ptData);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, authLoading]);

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
    const fromSignedOrConverted = lead.status === "signed" || lead.status === "submitted" || lead.status === "converted";
    // Pre-signature validation: check for below-cost pricing
    if (newStatus === "send_for_signature" && partnerSchedule) {
      const issues = getBelowCostFields();
      if (issues.length > 0) {
        setBelowCostItems(issues);
        setPendingStageAfterWarning(newStatus);
        setShowBelowCostWarning(true);
        return;
      }
    }
    if (newStatus === "unqualified") { setShowModal("unqualified"); setModalData({ reason: "", reason_other: "" }); }
    else if (newStatus === "declined") { setShowModal("declined"); setModalData({ reason: "" }); }
    else if (newStatus === "recycled") { setShowModal("recycled"); setModalData({ reason: "", follow_up_date: "" }); }
    else if (newStatus === "signed") { setShowModal("signed"); setModalData({}); }
    else if (newStatus === "qualified_prospect") { createDealAndUpdateStatus(); }
    else if (lead.status === "declined" && newStatus === "send_for_signature") {
      setShowModal("resubmit_from_declined"); setModalData({});
    }
    else if (fromSignedOrConverted && !["signed", "submitted", "converted"].includes(newStatus)) {
      setShowModal("backward_from_signed"); setModalData({ targetStatus: newStatus });
    }
    else { updateStatus(newStatus, {}); }
  };

  const createDealAndUpdateStatus = async () => {
    if (dealCreationGuard.current) return;
    dealCreationGuard.current = true;
    setSaving(true);
    const oldStatus = lead.status;
    const { data: existingDeals } = await supabase.from("deals").select("*").eq("lead_id", params.id).order("created_at");
    if (existingDeals && existingDeals.length > 0) {
      if (deals.length === 0) {
        setDeals(existingDeals);
        setActiveDealIdx(0);
        const { data: ownerData } = await supabase.from("deal_owners").select("id, full_name, title, ownership_pct, dob, phone, address, city, state, zip, ssn_encrypted, created_at, email, dl_state, dl_expiration, citizenship, is_us_resident, is_control_prong, personal_guarantee, prior_bankruptcies, criminal_history, match_tmf_listed").eq("lead_id", params.id as string).order("created_at");
        if (ownerData && ownerData.length > 0) setOwners(ownerData);
      }
    } else {
      const { data: newDeal } = await supabase.from("deals").insert({ lead_id: params.id as string, user_id: userId, business_legal_name: lead.business_name, dba_name: lead.business_name, is_primary_location: true }).select().single();
      if (newDeal) { setDeals([newDeal]); setActiveDealIdx(0); }
      await logActivity("deal_created", null, null, null, "Deal created");
    }
    await supabase.from("leads").update({ status: "qualified_prospect", updated_at: new Date().toISOString() }).eq("id", params.id);
    await logActivity("stage_change", "status", statusLabel(oldStatus), "Qualified Prospect", "Stage changed from " + statusLabel(oldStatus) + " to Qualified Prospect");
    setLead((prev: any) => ({ ...prev, status: "qualified_prospect", updated_at: new Date().toISOString() }));
    setSaving(false);
    dealCreationGuard.current = false;
  };

  const deleteLocation = async () => {
    if (!deleteLocationTarget) return;
    setDeletingLocation(true);
    const dealId = deleteLocationTarget.id;
    // Cascade: documents, deal-specific owners (only those with deal_id and no lead_id), then the deal
    await supabase.from("deal_documents").delete().eq("deal_id", dealId);
    await supabase.from("deal_owners").delete().eq("deal_id", dealId).is("lead_id", null);
    await supabase.from("deals").delete().eq("id", dealId);
    await logActivity("deal_updated", null, null, null, `Location deleted: ${deleteLocationTarget.location_name || deleteLocationTarget.dba_name || "Location"}`);
    // Refresh deals
    const { data: refreshed } = await supabase.from("deals").select("*").eq("lead_id", params.id).order("created_at");
    setDeals(refreshed || []);
    setActiveDealIdx(0);
    setDeleteLocationTarget(null);
    setDeletingLocation(false);
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
    const { error } = await supabase.from("leads").update({ status: newStatus, updated_at: new Date().toISOString(), ...extraFields }).eq("id", params.id);
    if (error) {
      console.error("Stage change failed:", JSON.stringify(error));
      setDealMsg("Stage change failed: " + error.message);
    } else {
      await logActivity("stage_change", "status", statusLabel(oldStatus), statusLabel(newStatus), "Stage changed from " + statusLabel(oldStatus) + " to " + statusLabel(newStatus));
      setLead((prev: any) => ({ ...prev, status: newStatus, updated_at: new Date().toISOString(), ...extraFields }));
      setShowModal("");
      // Auto-switch to DealInfo tab when entering stages that have deal-specific UI
      if (["send_for_signature", "signed", "submitted"].includes(newStatus)) {
        setLeadTab("DealInfo");
      }
    }
    setSaving(false);
  };

  const confirmBackwardFromSigned = async () => {
    setSaving(true);
    await deleteMerchantIfExists();
    await updateStatus(modalData.targetStatus, {});
    setSaving(false);
  };

  const convertToMerchant = async () => {
    if (!deal) return;
    setSaving(true);
    // Re-fetch this specific deal fresh
    const { data: dealData } = await supabase.from("deals").select("*").eq("id", deal.id).single();
    const merchantInsert: Record<string, any> = {
      user_id: userId,
      lead_id: lead.id,
      business_name: dealData?.dba_name || dealData?.location_name || lead.business_name,
      contact_name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      monthly_volume: lead.monthly_volume,
      status: "pending",
    };
    if (dealData) {
      const dealToMerchant: Record<string, string> = {
        dba_name: "dba_name",
        legal_street: "business_street", legal_city: "business_city", legal_state: "business_state", legal_zip: "business_zip",
        location_name: "location_name", location_street: "location_street", location_city: "location_city", location_state: "location_state", location_zip: "location_zip",
        pricing_type: "pricing_type",
        ic_plus_visa_pct: "ic_plus_visa_pct", ic_plus_mc_pct: "ic_plus_mc_pct", ic_plus_amex_pct: "ic_plus_amex_pct", ic_plus_disc_pct: "ic_plus_disc_pct",
        ic_plus_visa_txn: "ic_plus_visa_txn", ic_plus_mc_txn: "ic_plus_mc_txn", ic_plus_amex_txn: "ic_plus_amex_txn", ic_plus_disc_txn: "ic_plus_disc_txn",
        dual_pricing_rate: "dual_pricing_rate", dual_pricing_txn_fee: "dual_pricing_txn_fee",
        flat_rate_pct: "flat_rate_pct", flat_rate_txn_cost: "flat_rate_txn_cost",
        fee_chargeback: "fee_chargeback", fee_retrieval: "fee_retrieval", fee_arbitration: "fee_arbitration", fee_voice_auth: "fee_voice_auth", fee_ebt_auth: "fee_ebt_auth", fee_ach_reject: "fee_ach_reject",
        monthly_fee_statement: "monthly_fee_statement", monthly_fee_custom_name: "monthly_fee_custom_name", monthly_fee_custom_amount: "monthly_fee_custom_amount",
        pci_compliance_monthly: "pci_compliance_monthly", pci_compliance_annual: "pci_compliance_annual", interchange_remittance: "interchange_remittance",
        terminal_type: "terminal_type", terminal_cost: "equipment_cost", monthly_volume: "monthly_volume",
        high_ticket_limit: "high_ticket_limit", reserve_type: "reserve_type", funding_delay: "funding_delay",
      };
      for (const [dealField, merchantField] of Object.entries(dealToMerchant)) {
        const val = (dealData as Record<string, any>)[dealField];
        if (val != null && val !== "") merchantInsert[merchantField] = val;
      }
      if (dealData.free_hardware === "yes") merchantInsert.free_equipment = "yes";
      else if (dealData.free_hardware === "no") merchantInsert.free_equipment = "no";
      if (dealData.hardware_items) merchantInsert.hardware_items = dealData.hardware_items;
      if (dealData.software_items) merchantInsert.software_items = dealData.software_items;
      if (dealData.partner_id) merchantInsert.partner_id = dealData.partner_id;
    }
    // Auto-populate summary pricing fields
    if (merchantInsert.ic_plus_visa_pct) merchantInsert.pricing_rate = merchantInsert.ic_plus_visa_pct;
    if (merchantInsert.ic_plus_visa_txn) merchantInsert.per_transaction_fee = merchantInsert.ic_plus_visa_txn;
    const statementFee = parseFloat(merchantInsert.monthly_fee_statement) || 0;
    const customFee = parseFloat(merchantInsert.monthly_fee_custom_amount) || 0;
    const pciFee = parseFloat(merchantInsert.pci_compliance_monthly) || (merchantInsert.pci_compliance_annual ? parseFloat(merchantInsert.pci_compliance_annual) / 12 : 0) || 0;
    merchantInsert.monthly_fees = statementFee + customFee + pciFee;
    const { data: merchant, error: merchantError } = await supabase.from("merchants").insert(merchantInsert).select().single();
    if (merchantError) { setSaving(false); return; }
    // Check if ALL deals for this lead are now converted (have merchants)
    const { data: allMerchants } = await supabase.from("merchants").select("id").eq("lead_id", lead.id);
    const { data: allDeals } = await supabase.from("deals").select("id").eq("lead_id", lead.id);
    const allConverted = allDeals && allMerchants && allMerchants.length >= allDeals.length;
    if (allConverted) {
      await supabase.from("leads").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", params.id);
      await logActivity("stage_change", "status", statusLabel(lead.status), "Converted", "All locations converted to merchants");
      setLead((prev: any) => ({ ...prev, status: "converted", updated_at: new Date().toISOString() }));
    } else {
      await logActivity("deal_updated", null, null, null, `Location "${deal.location_name || deal.dba_name || 'Primary'}" converted to merchant`);
    }
    setShowModal("");
    setSaving(false);
    router.push("/dashboard/merchants/" + merchant.id);
  };

  const updateDealField = (field: string, value: any) => { setDeal((prev: any) => ({ ...prev, [field]: value })); };

  const addLocation = async () => {
    if (!lead) return;
    setSaving(true);
    const insert: Record<string, any> = {
      lead_id: lead.id,
      user_id: userId,
      business_legal_name: lead.business_name,
      dba_name: newLocationName || lead.business_name,
      location_name: newLocationName,
      is_primary_location: false,
    };
    // Copy pricing from an existing deal if selected
    if (copyFromDealId) {
      const source = deals.find(d => d.id === copyFromDealId);
      if (source) {
        const copyFields = ["pricing_type", "ic_plus_visa_pct", "ic_plus_mc_pct", "ic_plus_amex_pct", "ic_plus_disc_pct", "ic_plus_visa_txn", "ic_plus_mc_txn", "ic_plus_amex_txn", "ic_plus_disc_txn", "interchange_remittance", "dual_pricing_rate", "dual_pricing_txn_fee", "flat_rate_pct", "flat_rate_txn_cost", "fee_chargeback", "fee_retrieval", "fee_arbitration", "fee_voice_auth", "fee_ebt_auth", "fee_ach_reject", "monthly_fee_statement", "pci_compliance_monthly", "pci_compliance_annual", "monthly_fee_custom_name", "monthly_fee_custom_amount", "partner_id"];
        for (const f of copyFields) { if (source[f] != null && source[f] !== "") insert[f] = source[f]; }
      }
    }
    const { data: newDeal } = await supabase.from("deals").insert(insert).select().single();
    if (newDeal) {
      setDeals(prev => [...prev, newDeal]);
      setActiveDealIdx(deals.length); // switch to new deal
      await logActivity("deal_created", null, null, null, `New location added: ${newLocationName || "Location " + (deals.length + 1)}`);
    }
    setShowAddLocation(false);
    setNewLocationName("");
    setCopyFromDealId("");
    setSaving(false);
  };

  // Template field mapping (template column → deal column)
  const TEMPLATE_TO_DEAL: Record<string, string> = {
    pricing_type: 'pricing_type',
    visa_rate: 'ic_plus_visa_pct', visa_txn: 'ic_plus_visa_txn',
    mc_rate: 'ic_plus_mc_pct', mc_txn: 'ic_plus_mc_txn',
    discover_rate: 'ic_plus_disc_pct', discover_txn: 'ic_plus_disc_txn',
    amex_rate: 'ic_plus_amex_pct', amex_txn: 'ic_plus_amex_txn',
    fee_chargebacks: 'fee_chargeback', fee_retrievals: 'fee_retrieval',
    fee_arbitration: 'fee_arbitration', fee_voice_auths: 'fee_voice_auth',
    fee_ebt_auths: 'fee_ebt_auth', fee_ach_reject: 'fee_ach_reject',
    fee_statement: 'monthly_fee_statement',
    custom_fee_name: 'monthly_fee_custom_name', custom_fee_amount: 'monthly_fee_custom_amount',
  };

  // ── Partner cost tooltip system ──────────────────────────────────────────
  // Explicit mapping: deal field → path into partner pricing_data[0] nested structure
  // Partner data has nested sections: transaction_fees.auth_fee, chargeback_fees.chargeback_fee, etc.
  type CostMapping = { path: string[]; label: string; showBps?: boolean };
  const DEAL_TO_PARTNER_COST: Record<string, CostMapping> = {
    ic_plus_visa_pct:    { path: ['interchange_plus'], label: 'Visa %', showBps: true },
    ic_plus_mc_pct:      { path: ['interchange_plus'], label: 'MC %', showBps: true },
    ic_plus_amex_pct:    { path: ['interchange_plus'], label: 'AMEX %', showBps: true },
    ic_plus_disc_pct:    { path: ['interchange_plus'], label: 'Disc %', showBps: true },
    ic_plus_visa_txn:    { path: ['transaction_fees', 'auth_fee'], label: 'Visa $/txn' },
    ic_plus_mc_txn:      { path: ['transaction_fees', 'auth_fee'], label: 'MC $/txn' },
    ic_plus_amex_txn:    { path: ['transaction_fees', 'auth_fee'], label: 'AMEX $/txn' },
    ic_plus_disc_txn:    { path: ['transaction_fees', 'auth_fee'], label: 'Disc $/txn' },
    fee_chargeback:      { path: ['chargeback_fees', 'chargeback_fee'], label: 'Chargebacks' },
    fee_retrieval:       { path: ['chargeback_fees', 'retrieval_fee'], label: 'Retrievals' },
    fee_arbitration:     { path: ['chargeback_fees', 'arbitration_fee'], label: 'Arbitration' },
    fee_voice_auth:      { path: ['transaction_fees', 'voice_auth_fee'], label: 'Voice Auth' },
    fee_ebt_auth:        { path: ['transaction_fees', 'debit_ebt_fee'], label: 'EBT Auth' },
    fee_ach_reject:      { path: ['other_fees', 'ach_returns_fee'], label: 'ACH Reject' },
    monthly_fee_statement: { path: ['monthly_fees', 'statement_fee'], label: 'Statement Fee' },
  };

  // Resolve a dot-path into the partner schedule object, returning the raw string value
  const resolvePartnerPath = (path: string[]): string | null => {
    if (!partnerSchedule) return null;
    let current: any = partnerSchedule;
    for (const key of path) {
      if (current == null || typeof current !== 'object') return null;
      current = current[key];
    }
    if (current == null) return null;
    return typeof current === 'object' ? JSON.stringify(current) : String(current);
  };

  // Get partner cost info for a deal field — returns { raw: string, numeric: number | null }
  const getPartnerCostInfo = (dealField: string): { raw: string; numeric: number | null; bps: string | null } | null => {
    if (!partnerSchedule) return null;
    const mapping = DEAL_TO_PARTNER_COST[dealField];
    if (!mapping) return null;
    const raw = resolvePartnerPath(mapping.path);
    const displayRaw = raw || 'Not specified';
    // Try to extract first number for comparison
    let numeric: number | null = null;
    if (raw) {
      const match = raw.match(/[\d.]+/);
      if (match) numeric = parseFloat(match[0]);
    }
    // Bank BPS for percentage fields
    let bps: string | null = null;
    if (mapping.showBps && partnerSchedule.bank_sponsorship_bps) {
      bps = String(partnerSchedule.bank_sponsorship_bps);
    }
    return { raw: displayRaw, numeric: isNaN(numeric as number) ? null : numeric, bps };
  };

  // Check all pricing fields for below-cost issues
  const getBelowCostFields = (): { label: string; sell: number; buy: number }[] => {
    if (!deal || !partnerSchedule) return [];
    const issues: { label: string; sell: number; buy: number }[] = [];
    for (const [dealField, mapping] of Object.entries(DEAL_TO_PARTNER_COST)) {
      const sell = parseFloat(deal[dealField]);
      const info = getPartnerCostInfo(dealField);
      if (!isNaN(sell) && info?.numeric != null && sell < info.numeric) {
        issues.push({ label: mapping.label, sell, buy: info.numeric });
      }
    }
    return issues;
  };

  // Auto-create a deal when user starts editing pricing fields (before qualified_prospect stage)
  // Returns the deal object (existing or newly created)
  const ensureDeal = async (): Promise<any> => {
    if (deal) return deal;
    if (ensureDealGuard.current || !lead || !userId) return null;
    ensureDealGuard.current = true;
    const { data: existing } = await supabase.from("deals").select("*").eq("lead_id", lead.id).order("created_at").limit(1);
    if (existing && existing.length > 0) {
      setDeals(existing);
      setActiveDealIdx(0);
      ensureDealGuard.current = false;
      return existing[0];
    }
    const insert: any = { lead_id: lead.id, user_id: userId, business_legal_name: lead.business_name, dba_name: lead.business_name, is_primary_location: true };
    // Auto-apply default pricing template
    const defaultTpl = pricingTemplates.find(t => t.is_default);
    if (defaultTpl) {
      for (const [tplKey, dealKey] of Object.entries(TEMPLATE_TO_DEAL)) {
        if (defaultTpl[tplKey] != null) insert[dealKey] = defaultTpl[tplKey];
      }
      if (defaultTpl.pci_type === 'monthly') { insert.pci_compliance_monthly = defaultTpl.pci_amount; }
      else if (defaultTpl.pci_type === 'annual') { insert.pci_compliance_annual = defaultTpl.pci_amount; }
      if (defaultTpl.hardware_items?.length > 0) insert.hardware_items = defaultTpl.hardware_items;
      if (defaultTpl.software_items?.length > 0) insert.software_items = defaultTpl.software_items;
    }
    const { data: newDeal } = await supabase.from("deals").insert(insert).select().single();
    if (newDeal) { setDeals([newDeal]); setActiveDealIdx(0); }
    ensureDealGuard.current = false;
    return newDeal || null;
  };

  // ── Pricing template helpers ────────────────────────────────────────────
  const applyTemplate = (tpl: any) => {
    if (!deal) return;
    const updates: any = { ...deal };
    for (const [tplKey, dealKey] of Object.entries(TEMPLATE_TO_DEAL)) {
      if (tpl[tplKey] != null) updates[dealKey] = tpl[tplKey];
    }
    // PCI
    if (tpl.pci_type === 'monthly') { updates.pci_compliance_monthly = tpl.pci_amount; updates.pci_compliance_annual = null; }
    else if (tpl.pci_type === 'annual') { updates.pci_compliance_annual = tpl.pci_amount; updates.pci_compliance_monthly = null; }
    // Hardware & software
    if (tpl.hardware_items?.length > 0) updates.hardware_items = tpl.hardware_items;
    if (tpl.software_items?.length > 0) updates.software_items = tpl.software_items;
    setDeal(updates);
    setShowApplyConfirm(null);
    setAppliedTemplateId(tpl.id);
    setDealMsg("Template applied!");
    setTimeout(() => setDealMsg(""), 2000);
  };

  const clearPricing = () => {
    if (!deal) return;
    const cleared: any = { ...deal };
    for (const dealKey of Object.values(TEMPLATE_TO_DEAL)) cleared[dealKey] = null;
    cleared.pci_compliance_monthly = null;
    cleared.pci_compliance_annual = null;
    cleared.hardware_items = [];
    cleared.software_items = [];
    cleared.dual_pricing_rate = null;
    cleared.dual_pricing_txn_fee = null;
    cleared.flat_rate_pct = null;
    cleared.flat_rate_txn_cost = null;
    setDeal(cleared);
    setAppliedTemplateId('');
    setDealMsg("Pricing cleared");
    setTimeout(() => setDealMsg(""), 2000);
  };

  const saveAsTemplate = async () => {
    if (!deal || !saveTplName.trim()) return;
    setSaveTplSaving(true);
    const orgId = member?.org_id;
    if (saveTplDefault && orgId) {
      await supabase.from("pricing_templates").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
    }
    const payload: any = {
      org_id: orgId,
      name: saveTplName.trim(),
      is_default: saveTplDefault,
      pricing_type: deal.pricing_type || null,
      visa_rate: deal.ic_plus_visa_pct || null, visa_txn: deal.ic_plus_visa_txn || null,
      mc_rate: deal.ic_plus_mc_pct || null, mc_txn: deal.ic_plus_mc_txn || null,
      discover_rate: deal.ic_plus_disc_pct || null, discover_txn: deal.ic_plus_disc_txn || null,
      amex_rate: deal.ic_plus_amex_pct || null, amex_txn: deal.ic_plus_amex_txn || null,
      fee_chargebacks: deal.fee_chargeback || null, fee_retrievals: deal.fee_retrieval || null,
      fee_arbitration: deal.fee_arbitration || null, fee_voice_auths: deal.fee_voice_auth || null,
      fee_ebt_auths: deal.fee_ebt_auth || null, fee_ach_reject: deal.fee_ach_reject || null,
      fee_statement: deal.monthly_fee_statement || null,
      pci_type: deal.pci_compliance_monthly ? 'monthly' : deal.pci_compliance_annual ? 'annual' : null,
      pci_amount: deal.pci_compliance_monthly || deal.pci_compliance_annual || null,
      custom_fee_name: deal.monthly_fee_custom_name || null,
      custom_fee_amount: deal.monthly_fee_custom_amount || null,
      hardware_items: deal.hardware_items || [],
      software_items: deal.software_items || [],
    };
    await supabase.from("pricing_templates").insert(payload);
    setShowSaveAsTpl(false);
    setSaveTplName('');
    setSaveTplDefault(false);
    setSaveTplSaving(false);
    setDealMsg("Template saved!");
    setTimeout(() => setDealMsg(""), 2000);
    // Refresh templates
    if (orgId) {
      const { data } = await supabase.from("pricing_templates").select("*").eq("org_id", orgId).order("name");
      if (data) setPricingTemplates(data);
    }
  };

  // ── Signature flow helpers ───────────────────────────────────────────────
  const fetchBanksForPartner = async (partnerId: string) => {
    const { data } = await supabase.from("partner_sponsor_banks").select("id, bank_name").eq("partner_id", partnerId).order("bank_name");
    setSigBanks(data || []);
  };

  const fetchTemplateForBank = async (partnerId: string, bankName: string) => {
    const { data } = await supabase.from("mpa_templates").select("*").eq("partner_id", partnerId).eq("sponsor_bank", bankName).eq("is_active", true).limit(1).maybeSingle();
    setSigTemplate(data || null);
  };

  const fetchSigSessions = useCallback(async () => {
    if (!lead) return;
    const dealIds = deals.map(d => d.id).filter(Boolean);
    if (dealIds.length === 0) return;
    const { data } = await supabase.from("signature_sessions").select("*").in("deal_id", dealIds).order("created_at", { ascending: false });
    // Auto-expire pending sessions past their expiry
    const now = new Date();
    for (const s of data || []) {
      if (s.status === "pending" && new Date(s.expires_at) < now) {
        await supabase.from("signature_sessions").update({ status: "expired" }).eq("id", s.id);
        s.status = "expired";
      }
    }
    const grouped: Record<string, any[]> = {};
    for (const s of data || []) {
      if (!grouped[s.deal_id]) grouped[s.deal_id] = [];
      grouped[s.deal_id].push(s);
    }
    setSigSessions(grouped);
    // Fetch signed PDF documents for all sessions
    const signedSessionIds = (data || []).filter((s: any) => s.status === "signed").map((s: any) => s.id);
    if (signedSessionIds.length > 0) {
      const { data: docs } = await supabase.from("signed_documents").select("id, signature_session_id, document_type, file_url, created_at").in("signature_session_id", signedSessionIds).order("created_at");
      if (docs) {
        setSignedDocs(docs);
        const urls: Record<string, string> = {};
        await Promise.all(docs.map(async (doc: any) => {
          if (doc.file_url) { const signed = await getSignedUrl(doc.file_url); if (signed) urls[doc.id] = signed; }
        }));
        setSignedDocUrls(urls);
      }
    }
  }, [lead, deals]);

  useEffect(() => {
    // Fetch sessions for send_for_signature AND signed/submitted/converted (for signed docs display)
    if (["send_for_signature", "signed", "submitted", "converted", "declined"].includes(lead?.status) && deals.length > 0) {
      fetchSigSessions();
      // Pre-fill signer info from primary deal owner (control person, or first owner)
      if (!sigSignerName || !sigSignerEmail) {
        const controlOwner = owners.find((o: any) => o.is_control_prong) || owners[0];
        if (!sigSignerName) setSigSignerName(controlOwner?.full_name || lead.contact_name || "");
        if (!sigSignerEmail) setSigSignerEmail(controlOwner?.email || lead.email || "");
      }
      // Load banks for current deal's partner
      if (deal?.partner_id) fetchBanksForPartner(deal.partner_id);
    }
  }, [lead?.status, deals.length, deal?.partner_id, owners.length]);

  const handleSigPartnerChange = async (partnerId: string) => {
    if (!deal) return;
    updateDealField("partner_id", partnerId);
    updateDealField("sponsor_bank", null);
    setSigTemplate(null);
    if (partnerId) await fetchBanksForPartner(partnerId);
    else setSigBanks([]);
  };

  const handleSigBankChange = async (bankName: string) => {
    if (!deal) return;
    updateDealField("sponsor_bank", bankName);
    if (bankName && deal.partner_id) await fetchTemplateForBank(deal.partner_id, bankName);
    else setSigTemplate(null);
  };

  const sendForSignature = async (dealId: string) => {
    if (!lead || !sigSignerEmail || !sigSignerName) return;
    const currentDeal = deals.find(d => d.id === dealId) || deal;
    setSigSending(true);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + parseInt(sigExpiry) * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("signature_sessions").insert({
      org_id: member?.org_id || null,
      deal_id: dealId,
      lead_id: lead.id,
      partner_id: currentDeal?.partner_id || null,
      token,
      signer_name: sigSignerName,
      signer_email: sigSignerEmail,
      status: "pending",
      expires_at: expiresAt,
    });
    // Save deal fields
    await saveDeal();
    await fetchSigSessions();
    setSigSending(false);
  };

  const revokeSigSession = async (sessionId: string) => {
    await supabase.from("signature_sessions").update({ status: "revoked" }).eq("id", sessionId);
    await fetchSigSessions();
  };

  const copySigLink = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    setSigCopied(token);
    setTimeout(() => setSigCopied(null), 2000);
  };

  // ── Multi-partner selection helpers ──
  const togglePartnerSelection = async (partnerId: string) => {
    setSigPartnerSelections(prev => {
      if (prev[partnerId]) {
        const { [partnerId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [partnerId]: { bank: "", banks: [], template: null } };
    });
    // Fetch banks for newly checked partner
    if (!sigPartnerSelections[partnerId]) {
      const { data } = await supabase.from("partner_sponsor_banks").select("id, bank_name").eq("partner_id", partnerId).order("bank_name");
      setSigPartnerSelections(prev => prev[partnerId] ? { ...prev, [partnerId]: { ...prev[partnerId], banks: data || [] } } : prev);
    }
  };

  const setPartnerBank = async (partnerId: string, bankName: string) => {
    let template: any = null;
    if (bankName) {
      const { data } = await supabase.from("mpa_templates").select("*").eq("partner_id", partnerId).eq("sponsor_bank", bankName).eq("is_active", true).limit(1).maybeSingle();
      template = data || null;
    }
    setSigPartnerSelections(prev => ({
      ...prev,
      [partnerId]: { ...prev[partnerId], bank: bankName, template },
    }));
  };

  const sendBatchForSignature = async (dealId: string) => {
    if (!lead || !sigSignerEmail || !sigSignerName) return;
    const selectedIds = Object.keys(sigPartnerSelections);
    if (selectedIds.length === 0) return;
    setSigSending(true);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + parseInt(sigExpiry) * 24 * 60 * 60 * 1000).toISOString();
    const primaryPartnerId = selectedIds[0];
    const primaryBank = sigPartnerSelections[primaryPartnerId]?.bank || null;
    // Save the primary partner on the deal for the signing page display
    updateDealField("partner_id", primaryPartnerId);
    if (primaryBank) updateDealField("sponsor_bank", primaryBank);
    await supabase.from("signature_sessions").insert({
      org_id: member?.org_id || null,
      deal_id: dealId,
      lead_id: lead.id,
      partner_id: primaryPartnerId,
      partner_ids: selectedIds,
      token,
      signer_name: sigSignerName,
      signer_email: sigSignerEmail,
      status: "pending",
      expires_at: expiresAt,
    });
    await saveDeal();
    await fetchSigSessions();
    setSigSending(false);
  };

  // Reuse signature for multiple new partners at once
  const reuseBatchSignature = async (dealId: string, originalSession: any, partnerIds: string[]) => {
    if (!lead) return;
    setSigSending(true);
    for (const pid of partnerIds) {
      const sel = sigPartnerSelections[pid];
      const { data: newSession } = await supabase.from("signature_sessions").insert({
        org_id: member?.org_id || null,
        deal_id: dealId,
        lead_id: lead.id,
        partner_id: pid,
        token: crypto.randomUUID(),
        signer_name: originalSession.signer_name,
        signer_email: originalSession.signer_email,
        signer_ip: originalSession.signer_ip,
        signer_user_agent: originalSession.signer_user_agent,
        signature_data: originalSession.signature_data,
        consent_given: originalSession.consent_given,
        signed_at: originalSession.signed_at,
        signed_data_snapshot: buildDataSnapshot(deal, owners),
        reused_from_session_id: originalSession.id,
        status: "signed",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).select("id").single();
      if (newSession?.id) {
        authFetch("/api/regenerate-pdfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature_session_id: newSession.id }),
        }).catch(() => {});
      }
    }
    await logActivity("mpa_signature_reused", null, null, null,
      `Signature reused for ${partnerIds.length} partner${partnerIds.length > 1 ? "s" : ""}`);
    await fetchSigSessions();
    setSigSending(false);
  };

  // Get partner IDs that already have signed sessions for this deal
  const getSignedPartnerIds = (dealId: string): Set<string> => {
    const sessions = sigSessions[dealId] || [];
    return new Set(sessions.filter((s: any) => s.status === "signed" && s.partner_id).map((s: any) => s.partner_id));
  };

  // Update per-partner submission status on the deal
  const updatePartnerSubmissionStatus = async (partnerId: string, status: string) => {
    if (!deal) return;
    const current = deal.partner_submission_status || {};
    const updated = { ...current, [partnerId]: { ...current[partnerId], status, updated_at: new Date().toISOString() } };
    updateDealField("partner_submission_status", updated);
    await supabase.from("deals").update({ partner_submission_status: updated }).eq("id", deal.id);
    const pName = getPartnerNameById(partnerId);
    await logActivity("partner_status_update", null, null, null, `${pName} submission status: ${status}`);
  };

  const partnerStatusOptions = ["signed", "submitted", "under_review", "approved", "declined", "withdrawn"];

  const regeneratePdfs = async (sessionId: string) => {
    setRegenerating(sessionId);
    try {
      const res = await authFetch("/api/regenerate-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_session_id: sessionId }),
      });
      if (res.ok) {
        await fetchSigSessions();
        setDealMsg("PDFs regenerated!");
        setTimeout(() => setDealMsg(""), 2000);
      } else {
        const data = await res.json();
        setDealMsg("PDF regeneration failed: " + (data.error || "Unknown error"));
      }
    } catch {
      setDealMsg("PDF regeneration failed");
    }
    setRegenerating(null);
  };

  // Helper to get signed document URLs for a session
  const getSessionDocs = (sessionId: string) => signedDocs.filter(d => d.signature_session_id === sessionId);

  // Build a snapshot of critical deal fields for signature data change detection
  const buildDataSnapshot = (d: any, ownerList: any[]) => ({
    business_legal_name: d?.business_legal_name || null,
    dba_name: d?.dba_name || null,
    ein_itin: d?.ein_itin || null,
    monthly_volume: d?.monthly_volume || null,
    pricing_type: d?.pricing_type || null,
    owners: ownerList.map(o => ({ full_name: o.full_name || null, ownership_pct: o.ownership_pct || null })),
  });

  // Compare current deal data against a stored snapshot, return list of human-readable changes
  const getSnapshotChanges = (snapshot: any, d: any, ownerList: any[]): string[] => {
    if (!snapshot) return [];
    const changes: string[] = [];
    const labels: Record<string, string> = {
      business_legal_name: "Business Legal Name", dba_name: "DBA Name",
      ein_itin: "EIN/ITIN", monthly_volume: "Monthly Volume", pricing_type: "Pricing Type",
    };
    for (const key of Object.keys(labels)) {
      const oldVal = snapshot[key] ?? "";
      const newVal = (d as any)?.[key] ?? "";
      if (String(oldVal) !== String(newVal)) changes.push(`${labels[key]}: "${oldVal}" → "${newVal}"`);
    }
    const snapOwners = snapshot.owners || [];
    const currentOwners = ownerList.map(o => ({ full_name: o.full_name || null, ownership_pct: o.ownership_pct || null }));
    if (JSON.stringify(snapOwners) !== JSON.stringify(currentOwners)) changes.push("Owner names or ownership percentages changed");
    return changes;
  };

  // Reuse an existing signed signature for a new partner submission
  const reuseSignature = async (dealId: string, originalSession: any) => {
    if (!lead) return;
    const currentDeal = deals.find(d => d.id === dealId) || deal;
    setSigSending(true);
    const { data: newSession } = await supabase.from("signature_sessions").insert({
      org_id: member?.org_id || null,
      deal_id: dealId,
      lead_id: lead.id,
      partner_id: currentDeal?.partner_id || null,
      token: crypto.randomUUID(),
      signer_name: originalSession.signer_name,
      signer_email: originalSession.signer_email,
      signer_ip: originalSession.signer_ip,
      signer_user_agent: originalSession.signer_user_agent,
      signature_data: originalSession.signature_data,
      consent_given: originalSession.consent_given,
      signed_at: originalSession.signed_at,
      signed_data_snapshot: buildDataSnapshot(currentDeal, owners),
      reused_from_session_id: originalSession.id,
      status: "signed",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).select("id").single();
    await saveDeal();
    await logActivity("mpa_signature_reused", null, null, null,
      `Signature reused from ${new Date(originalSession.signed_at).toLocaleDateString()} for new partner submission`);
    await fetchSigSessions();
    // Generate PDFs for the reused session in the background
    if (newSession?.id) {
      authFetch("/api/regenerate-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_session_id: newSession.id }),
      }).catch(() => {});
    }
    setSigSnapshotWarning(null);
    setSigSending(false);
  };

  // Handle "Reuse Signature" click — check for data changes first
  const handleReuseSignature = (dealId: string, originalSession: any) => {
    const currentDeal = deals.find(d => d.id === dealId) || deal;
    const changes = getSnapshotChanges(originalSession.signed_data_snapshot, currentDeal, owners);
    if (changes.length > 0) {
      setSigSnapshotWarning({ changes, originalSession });
    } else {
      reuseSignature(dealId, originalSession);
    }
  };

  // Get the partner name by id
  const getPartnerNameById = (pid: string | null) => {
    if (!pid) return "Unknown Partner";
    return partners.find(p => p.id === pid)?.name || "Unknown Partner";
  };

  // Find any signed session across all deals for this lead (for reuse detection)
  const findReusableSession = () => {
    for (const sessions of Object.values(sigSessions)) {
      const signed = sessions.find((s: any) => s.status === "signed" && s.signature_data);
      if (signed) return signed;
    }
    return null;
  };

  // Check MPA field completeness for a deal
  const checkMpaFields = (d: any) => {
    const checks = [
      { label: "Business Info", ok: !!(d?.business_legal_name && d?.dba_name && d?.legal_street && d?.ein_itin && d?.entity_type), missing: [!d?.business_legal_name && "Legal Name", !d?.dba_name && "DBA", !d?.legal_street && "Address", !d?.ein_itin && "EIN", !d?.entity_type && "Entity Type"].filter(Boolean) },
      { label: "Owner Info", ok: owners.length > 0 && !!(owners[0]?.full_name && owners[0]?.ssn_encrypted && owners[0]?.dob), missing: owners.length === 0 ? ["No owners"] : [!owners[0]?.full_name && "Name", !owners[0]?.ssn_encrypted && "SSN", !owners[0]?.dob && "DOB"].filter(Boolean) },
      { label: "Processing Info", ok: !!(d?.monthly_volume && d?.average_ticket && (d?.cp_pct || d?.cnp_pct)), missing: [!d?.monthly_volume && "Volume", !d?.average_ticket && "Avg Ticket", !(d?.cp_pct || d?.cnp_pct) && "CP/CNP %"].filter(Boolean) },
      { label: "Pricing", ok: !!(d?.pricing_type && (d?.ic_plus_visa_pct || d?.dual_pricing_rate || d?.flat_rate_pct)), missing: [!d?.pricing_type && "Pricing Type", !(d?.ic_plus_visa_pct || d?.dual_pricing_rate || d?.flat_rate_pct) && "Rates"].filter(Boolean) },
      { label: "Banking", ok: !!(d?.bank_routing && d?.bank_account), missing: [!d?.bank_routing && "Routing #", !d?.bank_account && "Account #"].filter(Boolean) },
      { label: "Equipment", ok: (d?.hardware_items || []).length > 0, missing: (d?.hardware_items || []).length === 0 ? ["None added"] : [] },
    ];
    return checks;
  };

  // Fetch rep codes for the assigned agent
  useEffect(() => {
    if (!lead?.assigned_to) { setAgentRepCodes([]); return; }
    const fetchRepCodes = async () => {
      const { data } = await supabase.from("agent_rep_codes").select("id, partner_id, rep_code, label, status, split_pct, code_type").eq("user_id", lead.assigned_to);
      if (data) {
        setAgentRepCodes(data);
        const partnerIds = [...new Set(data.map((r: any) => r.partner_id).filter(Boolean))];
        if (partnerIds.length > 0) {
          const { data: pData } = await supabase.from("partners").select("id, name").in("id", partnerIds);
          if (pData) {
            const map: Record<string, string> = {};
            for (const p of pData) map[p.id] = p.name;
            setRepCodePartners(map);
          }
        }
      }
    };
    fetchRepCodes();
  }, [lead?.assigned_to]);

  // Partner pricing — simplified: use first schedule from partner's pricing_data for cost tooltips
  // MPA completeness
  const mpaResult: MpaCompletenessResult = deal ? checkMpaCompleteness(deal, owners, documents) : { overallPercent: 0, sections: [], blockingCount: 0, warningCount: 0 };

  const selectedPartner = partners.find((p) => p.id === deal?.partner_id);
  const partnerSchedule = selectedPartner?.pricing_data?.[0] || null;

  const handlePartnerChange = (newPartnerId: string) => {
    setDeals(prev => {
      const next = [...prev];
      const current = next[activeDealIdx];
      if (!current) return prev;
      next[activeDealIdx] = { ...current, partner_id: newPartnerId || null };
      return next;
    });
  };

  const formatEIN = (val: string) => {
    const nums = val.replace(/[^0-9]/g, "").slice(0, 9);
    if (nums.length > 2) return nums.slice(0, 2) + "-" + nums.slice(2);
    return nums;
  };

  const saveDeal = async () => {
    setDealSaving(true);
    const { id, created_at, lead_id, user_id, ...raw } = deal;
    // Filter to only valid DB columns to prevent 400 errors
    const updates: Record<string, any> = {};
    for (const key of Object.keys(raw)) {
      if (VALID_DEAL_COLUMNS.has(key)) {
        updates[key] = raw[key] === "" ? null : raw[key];
      }
    }
    updates.updated_at = new Date().toISOString();
    const { error } = await supabase.from("deals").update(updates).eq("id", deal.id);
    if (error) {
      console.error("Deal save error:", JSON.stringify(error));
      setDealMsg("Error saving deal: " + error.message);
    } else {
      await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", params.id);
      setLead((prev: any) => ({ ...prev, updated_at: new Date().toISOString() }));
      await logActivity("deal_updated", null, null, null, "Deal details updated");
      setDealMsg("Deal saved!");
    }
    setDealSaving(false);
    setTimeout(() => setDealMsg(""), 2000);
  };

  const addOwner = async () => {
    if (!lead) return;
    const { data } = await supabase.from("deal_owners").insert({ deal_id: deal?.id || null, lead_id: lead.id, full_name: "" }).select().single();
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
    let ssnFailed = false;
    for (const o of owners) {
      const { id, created_at, _ssn_plain, ...raw } = o;
      // Filter to only valid DB columns to prevent 400 errors
      const updates: Record<string, any> = {};
      for (const key of Object.keys(raw)) {
        if (VALID_OWNER_COLUMNS.has(key)) {
          updates[key] = raw[key];
        }
      }
      // If there's a plaintext SSN pending, encrypt it then null out the raw ssn column
      if (_ssn_plain) {
        try {
          const res = await authFetch("/api/encrypt-ssn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ssn: _ssn_plain }),
          });
          if (!res.ok) {
            ssnFailed = true;
            continue;
          }
          const data = await res.json();
          if (data.encrypted) {
            updates.ssn_encrypted = data.encrypted;
            updates.ssn = null;
          }
        } catch (err) {
          ssnFailed = true;
          continue;
        }
      }
      const { error } = await supabase.from("deal_owners").update(updates).eq("id", id);
      if (error) {
        console.error("Owner save failed for id=" + id + ":", JSON.stringify(error));
        setDealMsg("Error saving owner: " + error.message);
      }
    }
    if (ssnFailed) {
      setDealMsg("SSN encryption failed — check your session and try again");
    }
    // Only clear plaintext markers for owners that saved successfully
    if (!ssnFailed) {
      setOwners(prev => prev.map(o => {
        const { _ssn_plain, ...rest } = o;
        return rest;
      }));
      setRevealedSsns({});
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
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) { alert("File size must be under 10MB"); e.target.value = ""; return; }
    setUploading(true);
    const filePath = userId + "/" + deal.id + "/" + selectedDocType + "/" + Date.now() + "_" + file.name;

    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) { setUploading(false); return; }

    const { data: docRecord } = await supabase.from("deal_documents").insert({
      deal_id: deal.id,
      doc_type: selectedDocType,
      file_name: file.name,
      file_url: filePath,
    }).select().single();

    if (docRecord) {
      const signed = await getSignedUrl(filePath);
      if (signed) setSignedUrls(prev => ({ ...prev, [docRecord.id]: signed }));
      setDocuments([...documents, docRecord]);
      await logActivity("document_uploaded", null, null, file.name, "Document uploaded: " + docTypeLabel(selectedDocType) + " - " + file.name);
    }
    setSelectedDocType("");
    setUploading(false);
    e.target.value = "";
  };

  const deleteDocument = async (doc: any) => {
    const storagePath = extractStoragePath(doc.file_url);
    if (storagePath) {
      await supabase.storage.from("deal-documents").remove([storagePath]);
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

  const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setStatementUploading(true);
    const file = e.target.files[0];
    const filePath = userId + "/" + (params.id as string) + "/statements/" + Date.now() + "_" + file.name;

    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) { setStatementUploading(false); return; }

    if (deal) {
      const { data: docRecord } = await supabase.from("deal_documents").insert({
        deal_id: deal.id,
        doc_type: "processing_statements",
        file_name: file.name,
        file_url: filePath,
      }).select().single();
      if (docRecord) {
        const signed = await getSignedUrl(filePath);
        if (signed) setSignedUrls(prev => ({ ...prev, [docRecord.id]: signed }));
        setDocuments([...documents, docRecord]);
        await logActivity("document_uploaded", null, null, file.name, "Processing statement uploaded: " + file.name);
      }
    } else {
      const signed = await getSignedUrl(filePath);
      setUploadedStatements(prev => [...prev, { file_name: file.name, file_url: signed || filePath }]);
    }

    setStatementUploading(false);
    setShowStatementModal(false);
    e.target.value = "";
  };

  const toggleSsnVisibility = async (idx: number) => {
    const owner = owners[idx];
    if (!owner) return;

    // If already revealed, hide it
    if (revealedSsns[idx] !== undefined) {
      setRevealedSsns(prev => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      return;
    }

    // If owner has a pending (unencrypted) SSN edit, just reveal it locally
    if (owner._ssn_plain) {
      setRevealedSsns(prev => ({ ...prev, [idx]: owner._ssn_plain }));
      return;
    }

    // Decrypt from server
    if (!owner.ssn_encrypted) return;
    setRevealingIdx(idx);
    try {
      const res = await authFetch("/api/decrypt-ssn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encrypted: owner.ssn_encrypted, deal_owner_id: owner.id }),
      });
      const data = await res.json();
      if (data.ssn) {
        setRevealedSsns(prev => ({ ...prev, [idx]: data.ssn }));
      }
    } catch (err) {
      console.error("Failed to decrypt SSN:", err);
    }
    setRevealingIdx(null);
  };

  const maskSsn = (ssn: string) => {
    if (!ssn) return "";
    const digits = ssn.replace(/[^0-9]/g, "");
    if (digits.length >= 4) return "•••-••-" + digits.slice(-4);
    return "•".repeat(ssn.length);
  };

  const handleCpChange = (val: string) => {
    if (val === "" || isNaN(Number(val))) {
      setDeal((prev: any) => ({ ...prev, cp_pct: val, cnp_pct: "" }));
    } else {
      const clamped = Math.min(100, Math.max(0, Number(val)));
      setDeal((prev: any) => ({ ...prev, cp_pct: val, cnp_pct: String(100 - clamped) }));
    }
  };

  const handleCnpChange = (val: string) => {
    if (val === "" || isNaN(Number(val))) {
      setDeal((prev: any) => ({ ...prev, cnp_pct: val, cp_pct: "" }));
    } else {
      const clamped = Math.min(100, Math.max(0, Number(val)));
      setDeal((prev: any) => ({ ...prev, cnp_pct: val, cp_pct: String(100 - clamped) }));
    }
  };

  const inputClass = "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-base";
  const labelClass = "text-base text-slate-500 block mb-1";
  const sectionClass = "bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6";

  // Helper: render a pricing input with optional partner cost tooltip
  const renderCostInput = (label: string, dealField: string, value: any, onChange: (v: string) => void, step = "0.01") => {
    const costInfo = getPartnerCostInfo(dealField);
    const sellVal = parseFloat(value);
    const hasValue = !isNaN(sellVal);
    const belowCost = hasValue && costInfo?.numeric != null && sellVal < costInfo.numeric;
    const hasTooltip = costInfo != null;
    // Build tooltip text
    let tooltipText = '';
    if (costInfo) {
      if (belowCost) {
        tooltipText = `\u26A0 Below cost! Partner: ${costInfo.raw}, Yours: ${sellVal}`;
      } else {
        tooltipText = `Partner cost: ${costInfo.raw}`;
        if (hasValue && costInfo.numeric != null) tooltipText += ` | Margin: ${(sellVal - costInfo.numeric).toFixed(2)}`;
      }
      if (costInfo.bps) tooltipText += ` | Bank BPS: ${costInfo.bps}`;
    }
    return (
      <div className="relative group">
        <label className={labelClass}>
          {label}
          {hasTooltip && (
            <span className="inline-block ml-1 relative">
              <svg className={`w-3.5 h-3.5 inline ${belowCost ? 'text-red-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] rounded-lg whitespace-nowrap max-w-xs truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                {tooltipText}
              </span>
            </span>
          )}
        </label>
        <input type="number" step={step} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${belowCost ? '!border-red-300 !ring-red-200' : ''}`} />
      </div>
    );
  };

  if (authLoading || loading) return <LoadingScreen />;

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

        {lead.status === "declined" && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Declined</span>
            {lead.declined_reason ? (
              <>
                <span className="text-red-400">&mdash;</span>
                <span
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  onBlur={async (e) => {
                    const newReason = e.currentTarget.textContent || "";
                    if (newReason !== lead.declined_reason) {
                      await supabase.from("leads").update({ declined_reason: newReason, updated_at: new Date().toISOString() }).eq("id", params.id);
                      setLead((prev: any) => ({ ...prev, declined_reason: newReason }));
                    }
                  }}
                  className={`${canEdit ? "cursor-text hover:bg-red-100 focus:bg-red-100 focus:outline-none px-1 -mx-1 rounded" : ""}`}
                >
                  {lead.declined_reason}
                </span>
              </>
            ) : (
              <span className="text-red-400 italic">No reason provided</span>
            )}
          </div>
        )}

        {/* ═══════════ TAB BAR ═══════════ */}
        <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
          {[
            { key: "Overview", label: "Overview" },
            { key: "Pricing", label: "Pricing" },
            { key: "Equipment", label: "Equipment" },
            ...(["qualified_prospect", "send_for_signature", "signed", "submitted", "converted"].includes(lead.status) ? [{ key: "DealInfo", label: "Deal Info" }] : []),
            { key: "Documents", label: "Documents", badge: documents.length },
            ...(deals.length > 1 ? [{ key: "Locations", label: "Locations", badge: deals.length }] : []),
            { key: "Activity", label: "Activity", badge: activities.length },
          ].map((t: any) => {
            const tabDot = deal ? getTabStatus(t.key, mpaResult) : null;
            return (
              <button
                key={t.key}
                onClick={() => setLeadTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                  leadTab === t.key ? 'text-emerald-600 border-emerald-600' : 'text-slate-500 hover:text-slate-700 border-transparent'
                }`}
              >
                {t.label}{t.badge > 0 ? ` (${t.badge})` : ''}
                {tabDot && <span className={`w-2 h-2 rounded-full inline-block ${tabDot === "green" ? "bg-emerald-500" : tabDot === "amber" ? "bg-amber-400" : "bg-red-500"}`} />}
              </button>
            );
          })}
        </div>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {leadTab === "Overview" && (<>
        {/* Action buttons */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => commLogRef.current?.openModal("call")} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150">
              <span className="mr-1.5">{"\uD83D\uDCDE"}</span>Log Call
            </button>
            {lead.phone && (
              <span className="text-emerald-600 text-sm font-medium">{lead.phone}</span>
            )}
            {lead.email ? (
              <button onClick={() => { window.open(`mailto:${lead.email}`); setTimeout(() => commLogRef.current?.openModal("email"), 1000); }} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150">
                <span className="mr-1.5">{"\u2709\uFE0F"}</span>Send Email
              </button>
            ) : (
              <span className="bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed" title="No email on file">
                <span className="mr-1.5">{"\u2709\uFE0F"}</span>Send Email
              </span>
            )}
            <button onClick={() => commLogRef.current?.openModal("note")} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150">
              <span className="mr-1.5">{"\uD83D\uDCDD"}</span>Add Note
            </button>
            <button onClick={() => commLogRef.current?.openTaskModal()} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150">
              <span className="mr-1.5">📋</span>Follow-up
            </button>
            <button onClick={() => setShowCommPanel(true)} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 relative">
              <span className="mr-1.5">🕒</span>History
              {commCount > 0 && <span className="ml-1.5 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium">{commCount}</span>}
            </button>
          </div>
        </div>

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
            {/* Statement Analysis */}
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setShowStatementModal(true)} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition">
                📄 Analyze Statement
              </button>
              {uploadedStatements.map((s, i) => (
                <a key={i} href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:text-emerald-700">
                  📄 {s.file_name}
                </a>
              ))}
              {documents.filter(d => d.doc_type === "processing_statements").map(doc => (
                signedUrls[doc.id] ? (
                  <a key={doc.id} href={signedUrls[doc.id]} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:text-emerald-700">
                    📄 {doc.file_name}
                  </a>
                ) : (
                  <span key={doc.id} className="text-sm text-slate-400">📄 {doc.file_name} (link expired, refresh to regenerate)</span>
                )
              ))}
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

        {/* MPA Readiness Widget */}
        {deal && ["qualified_prospect", "send_for_signature", "signed", "submitted"].includes(lead.status) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">MPA Readiness</h3>
              <span className={`text-sm font-medium ${mpaResult.overallPercent === 100 ? "text-emerald-600" : mpaResult.blockingCount > 0 ? "text-red-500" : "text-amber-500"}`}>
                {mpaResult.overallPercent === 100 ? "Ready to Send" : `${mpaResult.overallPercent}% Complete`}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
              <div className={`h-2.5 rounded-full transition-all duration-500 ${mpaResult.overallPercent === 100 ? "bg-emerald-500" : mpaResult.blockingCount > 0 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${mpaResult.overallPercent}%` }} />
            </div>
            {(mpaResult.blockingCount > 0 || mpaResult.warningCount > 0) && (
              <div className="flex gap-3 mb-3 text-xs">
                {mpaResult.blockingCount > 0 && <span className="text-red-500 font-medium">{mpaResult.blockingCount} blocking issue{mpaResult.blockingCount > 1 ? "s" : ""}</span>}
                {mpaResult.warningCount > 0 && <span className="text-amber-500 font-medium">{mpaResult.warningCount} warning{mpaResult.warningCount > 1 ? "s" : ""}</span>}
              </div>
            )}
            <div className="space-y-1.5">
              {mpaResult.sections.map((sec) => (
                <div key={sec.name} className="flex items-start gap-2">
                  <span className="text-sm mt-0.5 shrink-0">
                    {sec.status === "complete" ? <span className="text-emerald-500">✓</span> : sec.isBlocking ? <span className="text-red-500">✕</span> : <span className="text-amber-400">!</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button type="button" onClick={() => setLeadTab(sec.tab)} className="text-sm font-medium text-slate-700 hover:text-emerald-600 transition">
                      {sec.name}
                    </button>
                    {sec.missingFields.length > 0 && (
                      <p className="text-xs text-slate-400 truncate">{sec.missingFields.join(", ")}</p>
                    )}
                  </div>
                  {sec.status === "complete" && <span className="bg-emerald-50 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0">Complete</span>}
                  {sec.status !== "complete" && sec.isBlocking && <span className="bg-red-50 text-red-500 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0">{sec.missingFields.length} missing</span>}
                  {sec.status !== "complete" && !sec.isBlocking && <span className="bg-amber-50 text-amber-500 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0">{sec.missingFields.length} warning{sec.missingFields.length > 1 ? "s" : ""}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        </>)}
        {/* ═══════════ PRICING TAB ═══════════ */}
        {leadTab === "Pricing" && (<>
        <div className="space-y-6 mb-6" onFocus={ensureDeal}>

            {/* Template Selector & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                onChange={(e) => {
                  if (e.target.value === '') { setAppliedTemplateId(''); return; }
                  const tpl = pricingTemplates.find(t => t.id === e.target.value);
                  if (tpl) setShowApplyConfirm(tpl);
                }}
                value={appliedTemplateId}
                disabled={pricingTemplates.length === 0}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pricingTemplates.length === 0 ? (
                  <option value="">No templates — create one in Settings</option>
                ) : (
                  <>
                    <option value="">Apply Template...</option>
                    {pricingTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.is_default ? '\u2605 ' : ''}{t.name}</option>
                    ))}
                  </>
                )}
              </select>
              <Link href="/dashboard/settings" className="text-xs text-slate-400 hover:text-slate-600 font-medium">Manage Templates</Link>
              {deal && <button onClick={clearPricing} className="text-xs text-slate-400 hover:text-slate-600 font-medium">Clear Pricing</button>}
              <div className="flex-1" />
              {deal && <button onClick={() => setShowSaveAsTpl(true)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Save as Template</button>}
            </div>

            {/* Partner Selection */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Partner</label>
                  <select value={deal?.partner_id || ""} onChange={async (e) => { const val = e.target.value; const d = await ensureDeal(); if (d) handlePartnerChange(val); }} className={inputClass}>
                    <option value="">No Partner Selected</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className={sectionClass}>
              <h4 className="font-semibold mb-4 text-emerald-600">Pricing</h4>
              <div className="mb-4">
                <label className={labelClass}>Pricing Type</label>
                <select value={deal?.pricing_type || ""} onChange={async (e) => { await ensureDeal(); updateDealField("pricing_type", e.target.value); }} className={inputClass}>
                  <option value="">Select pricing type...</option>
                  <option value="interchange_plus">Interchange Plus</option>
                  <option value="dual_pricing">Dual Pricing</option>
                  <option value="surcharging">Surcharging</option>
                  <option value="tiered">Tiered</option>
                  <option value="flat_rate">Flat Rate</option>
                </select>
              </div>
              {deal?.pricing_type === "interchange_plus" && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Percentage Markups (%)</p>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {renderCostInput("Visa %", "ic_plus_visa_pct", deal.ic_plus_visa_pct, v => updateDealField("ic_plus_visa_pct", v))}
                    {renderCostInput("MC %", "ic_plus_mc_pct", deal.ic_plus_mc_pct, v => updateDealField("ic_plus_mc_pct", v))}
                    {renderCostInput("AMEX %", "ic_plus_amex_pct", deal.ic_plus_amex_pct, v => updateDealField("ic_plus_amex_pct", v))}
                    {renderCostInput("Disc %", "ic_plus_disc_pct", deal.ic_plus_disc_pct, v => updateDealField("ic_plus_disc_pct", v))}
                  </div>
                  <p className="text-sm text-slate-500 mb-2">Per Transaction ($)</p>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {renderCostInput("Visa $", "ic_plus_visa_txn", deal.ic_plus_visa_txn, v => updateDealField("ic_plus_visa_txn", v))}
                    {renderCostInput("MC $", "ic_plus_mc_txn", deal.ic_plus_mc_txn, v => updateDealField("ic_plus_mc_txn", v))}
                    {renderCostInput("AMEX $", "ic_plus_amex_txn", deal.ic_plus_amex_txn, v => updateDealField("ic_plus_amex_txn", v))}
                    {renderCostInput("Disc $", "ic_plus_disc_txn", deal.ic_plus_disc_txn, v => updateDealField("ic_plus_disc_txn", v))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Interchange Remittance</label><select value={deal.interchange_remittance || ""} onChange={(e) => updateDealField("interchange_remittance", e.target.value)} className={inputClass}><option value="">Select...</option><option value="daily">Daily</option><option value="monthly">Monthly</option></select></div>
                  </div>
                </div>
              )}
              {deal?.pricing_type === "dual_pricing" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Dual Pricing Rate (%)</label><input type="number" step="0.01" value={deal.dual_pricing_rate || ""} onChange={(e) => updateDealField("dual_pricing_rate", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Per Transaction Fee ($)</label><input type="number" step="0.01" value={deal.dual_pricing_txn_fee || ""} onChange={(e) => updateDealField("dual_pricing_txn_fee", e.target.value)} className={inputClass} /></div>
                </div>
              )}
              {deal?.pricing_type === "flat_rate" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Flat Rate (%)</label><input type="number" step="0.01" value={deal.flat_rate_pct || ""} onChange={(e) => updateDealField("flat_rate_pct", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Per Transaction ($)</label><input type="number" step="0.01" value={deal.flat_rate_txn_cost || ""} onChange={(e) => updateDealField("flat_rate_txn_cost", e.target.value)} className={inputClass} /></div>
                </div>
              )}
              {deal?.pricing_type === "tiered" && (
                <div className="bg-slate-100 rounded-lg p-4"><p className="text-slate-500 text-sm">Tiered pricing configuration coming soon.</p></div>
              )}
            </div>

            {/* Misc Fees */}
            <div className={sectionClass}>
              <h4 className="font-semibold mb-4 text-emerald-600">Misc Fees ($)</h4>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                {renderCostInput("Chargebacks", "fee_chargeback", deal?.fee_chargeback, v => updateDealField("fee_chargeback", v))}
                {renderCostInput("Retrievals", "fee_retrieval", deal?.fee_retrieval, v => updateDealField("fee_retrieval", v))}
                {renderCostInput("Arbitration", "fee_arbitration", deal?.fee_arbitration, v => updateDealField("fee_arbitration", v))}
                {renderCostInput("Voice Auths", "fee_voice_auth", deal?.fee_voice_auth, v => updateDealField("fee_voice_auth", v))}
                {renderCostInput("EBT Auths", "fee_ebt_auth", deal?.fee_ebt_auth, v => updateDealField("fee_ebt_auth", v))}
                {renderCostInput("ACH Reject", "fee_ach_reject", deal?.fee_ach_reject, v => updateDealField("fee_ach_reject", v))}
              </div>
            </div>

            {/* Monthly Fees */}
            <div className={sectionClass}>
              <h4 className="font-semibold mb-4 text-emerald-600">Monthly Fees</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className={labelClass}>Statement Fee</label><input type="number" step="0.01" value={deal?.monthly_fee_statement || ""} onChange={(e) => { updateDealField("monthly_fee_statement", e.target.value); }} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>PCI Type</label>
                  <select value={deal?.pci_compliance_monthly ? "monthly" : deal?.pci_compliance_annual ? "annual" : ""} onChange={async (e) => {
                    await ensureDeal();
                    if (!deal) return;
                    const currentAmount = deal.pci_compliance_monthly || deal.pci_compliance_annual || "";
                    if (e.target.value === "monthly") setDeal({ ...deal, pci_compliance_monthly: currentAmount, pci_compliance_annual: null });
                    else if (e.target.value === "annual") setDeal({ ...deal, pci_compliance_annual: currentAmount, pci_compliance_monthly: null });
                    else setDeal({ ...deal, pci_compliance_monthly: null, pci_compliance_annual: null });
                  }} className={inputClass}>
                    <option value="">Select...</option><option value="monthly">Monthly</option><option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>PCI Amount ($)</label>
                  <input type="number" step="0.01" value={deal?.pci_compliance_monthly || deal?.pci_compliance_annual || ""} onChange={(e) => {
                    if (!deal) return;
                    if (deal.pci_compliance_annual) updateDealField("pci_compliance_annual", e.target.value);
                    else updateDealField("pci_compliance_monthly", e.target.value);
                  }} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div><label className={labelClass}>Custom Fee Name</label><input type="text" value={deal?.monthly_fee_custom_name || ""} onChange={(e) => { updateDealField("monthly_fee_custom_name", e.target.value); }} className={inputClass} /></div>
                <div><label className={labelClass}>Custom Fee Amount</label><input type="number" step="0.01" value={deal?.monthly_fee_custom_amount || ""} onChange={(e) => { updateDealField("monthly_fee_custom_amount", e.target.value); }} className={inputClass} /></div>
              </div>
            </div>

            {/* Margin Summary */}
            {deal && partnerSchedule && (() => {
              const margins2: number[] = [];
              for (const [dealField2] of Object.entries(DEAL_TO_PARTNER_COST)) {
                const sell2 = parseFloat(deal[dealField2]);
                const info2 = getPartnerCostInfo(dealField2);
                if (!isNaN(sell2) && info2?.numeric != null) margins2.push(sell2 - info2.numeric);
              }
              if (margins2.length === 0) return null;
              const avg2 = margins2.reduce((s, m) => s + m, 0) / margins2.length;
              const negCount2 = margins2.filter(m => m < 0).length;
              return (
                <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm ${avg2 >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  <span className="font-medium">Margin Summary</span>
                  <span>Avg margin: {avg2 >= 0 ? '+' : ''}{avg2.toFixed(3)} across {margins2.length} fields{negCount2 > 0 ? ` \u00b7 ${negCount2} below cost` : ''}</span>
                </div>
              );
            })()}

            {/* Save Pricing button */}
            {deal && canEdit && (
              <div className="flex justify-end mb-4">
                <button onClick={saveDeal} disabled={dealSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">{dealSaving ? "Saving..." : "Save Pricing"}</button>
              </div>
            )}
          </div>
        </>)}

        {/* ═══════════ EQUIPMENT TAB ═══════════ */}
        {leadTab === "Equipment" && (<>
          <div className="space-y-6" onFocus={ensureDeal}>
            {/* Hardware */}
            <div className={sectionClass}>
              <h4 className="font-semibold mb-4 text-emerald-600">Hardware</h4>
              {(deal?.hardware_items || []).map((item: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-4 mb-3 border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Hardware {idx + 1}</span>
                    <button onClick={() => { const items = [...(deal.hardware_items || [])]; items.splice(idx, 1); updateDealField("hardware_items", items); }} className="text-red-400 hover:text-red-500 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div><label className={labelClass}>Type</label><select value={item.type || ""} onChange={(e) => { const items = [...(deal.hardware_items || [])]; items[idx] = { ...items[idx], type: e.target.value }; updateDealField("hardware_items", items); }} className={inputClass}><option value="">Select...</option><option value="terminal">Terminal</option><option value="mobile_reader">Mobile Reader</option><option value="pos_system">POS System</option><option value="pin_pad">Pin Pad</option><option value="printer">Printer</option><option value="other">Other</option></select></div>
                    <div><label className={labelClass}>Model</label><input type="text" value={item.model || ""} onChange={(e) => { const items = [...(deal.hardware_items || [])]; items[idx] = { ...items[idx], model: e.target.value }; updateDealField("hardware_items", items); }} className={inputClass} placeholder="e.g. Dejavoo QD4" /></div>
                    <div><label className={labelClass}>Quantity</label><input type="number" min="1" value={item.quantity || 1} onChange={(e) => { const items = [...(deal.hardware_items || [])]; items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 1 }; updateDealField("hardware_items", items); }} className={inputClass} /></div>
                    <div><label className={labelClass}>Cost ($)</label><input type="number" step="0.01" value={item.cost || ""} onChange={(e) => { const items = [...(deal.hardware_items || [])]; items[idx] = { ...items[idx], cost: e.target.value }; updateDealField("hardware_items", items); }} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>Free Placement</label><select value={item.free || ""} onChange={(e) => { const items = [...(deal.hardware_items || [])]; items[idx] = { ...items[idx], free: e.target.value }; updateDealField("hardware_items", items); }} className={inputClass}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                  </div>
                </div>
              ))}
              <button onClick={async () => { await ensureDeal(); const items = [...(deal?.hardware_items || [])]; items.push({ type: "", model: "", quantity: 1, cost: "", free: "" }); updateDealField("hardware_items", items); }} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">+ Add Hardware Item</button>
            </div>

            {/* Software / Gateways */}
            <div className={sectionClass}>
              <h4 className="font-semibold mb-4 text-emerald-600">Software / Gateways</h4>
              {(deal?.software_items || []).map((item: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-4 mb-3 border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Software {idx + 1}</span>
                    <button onClick={() => { const items = [...(deal.software_items || [])]; items.splice(idx, 1); updateDealField("software_items", items); }} className="text-red-400 hover:text-red-500 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div><label className={labelClass}>Name</label><input type="text" value={item.name || ""} onChange={(e) => { const items = [...(deal.software_items || [])]; items[idx] = { ...items[idx], name: e.target.value }; updateDealField("software_items", items); }} className={inputClass} placeholder="e.g. Authorize.net" /></div>
                    <div><label className={labelClass}>Type</label><select value={item.type || ""} onChange={(e) => { const items = [...(deal.software_items || [])]; items[idx] = { ...items[idx], type: e.target.value }; updateDealField("software_items", items); }} className={inputClass}><option value="">Select...</option><option value="gateway">Gateway</option><option value="pos">POS</option><option value="plugin">Plugin</option><option value="virtual_terminal">Virtual Terminal</option></select></div>
                    <div><label className={labelClass}>Monthly ($)</label><input type="number" step="0.01" value={item.monthly_cost || ""} onChange={(e) => { const items = [...(deal.software_items || [])]; items[idx] = { ...items[idx], monthly_cost: e.target.value }; updateDealField("software_items", items); }} className={inputClass} /></div>
                    <div><label className={labelClass}>Per Txn ($)</label><input type="number" step="0.01" value={item.per_txn || ""} onChange={(e) => { const items = [...(deal.software_items || [])]; items[idx] = { ...items[idx], per_txn: e.target.value }; updateDealField("software_items", items); }} className={inputClass} /></div>
                  </div>
                </div>
              ))}
              <button onClick={async () => { await ensureDeal(); const items = [...(deal?.software_items || [])]; items.push({ name: "", type: "", monthly_cost: "", per_txn: "" }); updateDealField("software_items", items); }} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">+ Add Software Item</button>
            </div>

            {/* Save Equipment button */}
            {deal && canEdit && (
              <div className="flex justify-end mb-4">
                <button onClick={saveDeal} disabled={dealSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">{dealSaving ? "Saving..." : "Save Equipment"}</button>
              </div>
            )}
          </div>
        </>)}

        {/* CommunicationLog: always rendered for modal system */}
        <div className="h-0 overflow-hidden" aria-hidden="true">
          <CommunicationLog
            ref={commLogRef}
            leadId={lead.id}
            dealId={deal?.id}
            contactName={lead.contact_name}
            contactPhone={lead.phone}
            contactEmail={lead.email}
            onTaskCreated={fetchTasks}
            hideActionBar
          />
        </div>

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


        {/* ═══════════ DEAL INFO TAB ═══════════ */}
        {leadTab === "DealInfo" && (<>
        {/* ═══════════ SEND FOR SIGNATURE SECTION ═══════════ */}
        {lead.status === "send_for_signature" && deals.length > 0 && (
          <div className="space-y-4 mb-6">
            <h3 className="text-xl font-bold">Send for Signature</h3>
            {deals.map((d, dIdx) => {
              const sessions = sigSessions[d.id] || [];
              const latestSession = sessions[0];
              const isActiveDeal = dIdx === activeDealIdx;
              const mpaChecks = checkMpaFields(d);
              const reusableSession = findReusableSession();
              // Only show reuse banner when there's no active/pending session for this deal
              // and the reusable session is from a different partner than currently selected
              const showReuseBanner = reusableSession && (!latestSession || latestSession.status === "expired" || latestSession.status === "revoked") && d.partner_id;

              return (
                <div key={d.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  {deals.length > 1 && (
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                      {d.is_primary_location && <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>}
                      <h4 className="text-base font-semibold text-slate-900">{d.location_name || d.dba_name || `Location ${dIdx + 1}`}</h4>
                    </div>
                  )}

                  {/* Current signed/pending session status (compact) */}
                  {latestSession && latestSession.status === "pending" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span>{"\u23F3"}</span>
                          <div>
                            <p className="text-sm font-medium text-blue-900">Awaiting signature{latestSession.partner_id ? ` — ${getPartnerNameById(latestSession.partner_id)}` : ""}</p>
                            <p className="text-xs text-blue-600">Sent to {latestSession.signer_email} &middot; Expires {new Date(latestSession.expires_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => copySigLink(latestSession.token)} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-1.5 text-xs font-medium transition">{sigCopied === latestSession.token ? "Copied!" : "Copy Link"}</button>
                          <button onClick={() => { sendForSignature(d.id); }} disabled={sigSending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50">Resend</button>
                          <button onClick={() => revokeSigSession(latestSession.id)} className="text-red-500 hover:text-red-600 text-xs font-medium">Revoke</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {latestSession && latestSession.status === "signed" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span>{"\u2705"}</span>
                        <div>
                          <p className="text-sm font-medium text-emerald-800">
                            Signed{latestSession.partner_id ? ` — ${getPartnerNameById(latestSession.partner_id)}` : ""}
                            {latestSession.reused_from_session_id ? " (reused)" : ""}
                          </p>
                          <p className="text-xs text-emerald-600">
                            {latestSession.signer_name} on {new Date(latestSession.signed_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Partner & Sponsor Bank — always shown */}
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
                        <h4 className="text-sm font-semibold text-slate-900">Select Partners & Sponsor Banks</h4>
                      </div>
                      {(() => {
                        const signedPids = getSignedPartnerIds(d.id);
                        return (
                          <div className="space-y-2">
                            {partners.map(p => {
                              const alreadySigned = signedPids.has(p.id);
                              const isChecked = !!sigPartnerSelections[p.id];
                              const sel = sigPartnerSelections[p.id];
                              return (
                                <div key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${alreadySigned ? "border-emerald-200 bg-emerald-50" : isChecked ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked || alreadySigned}
                                    disabled={alreadySigned}
                                    onChange={() => { if (isActiveDeal && !alreadySigned) togglePartnerSelection(p.id); }}
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-sm font-medium text-slate-900 min-w-[120px]">{p.name}</span>
                                  {alreadySigned ? (
                                    <span className="text-xs text-emerald-600 font-medium">{"\u2705"} Signed</span>
                                  ) : isChecked ? (
                                    <>
                                      <select
                                        value={sel?.bank || ""}
                                        onChange={(e) => setPartnerBank(p.id, e.target.value)}
                                        className="text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500 flex-1 max-w-[200px]"
                                      >
                                        <option value="">Sponsor Bank...</option>
                                        {(sel?.banks || []).map((b: any) => <option key={b.id} value={b.bank_name}>{b.bank_name}</option>)}
                                      </select>
                                      {sel?.bank && (
                                        <span className={`text-[10px] font-medium ${sel.template ? "text-emerald-600" : "text-amber-500"}`}>
                                          {sel.template ? `MPA \u2713` : "\u26A0 No template"}
                                        </span>
                                      )}
                                    </>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Reuse banner: show when there's a reusable signature and new unchecked partners */}
                    {(() => {
                      const signedSession = reusableSession;
                      const selectedNewIds = Object.keys(sigPartnerSelections).filter(pid => !getSignedPartnerIds(d.id).has(pid));
                      if (!signedSession || selectedNewIds.length === 0) return null;
                      return (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-lg mt-0.5">{"\u2705"}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-emerald-800">Existing signature available</p>
                              <p className="text-xs text-emerald-600 mt-0.5">
                                Signed by {signedSession.signer_name} on {new Date(signedSession.signed_at).toLocaleDateString()}.
                                Reuse for {selectedNewIds.map(pid => getPartnerNameById(pid)).join(", ")}?
                              </p>
                              <div className="flex items-center gap-3 mt-3">
                                <button
                                  onClick={() => {
                                    const allHaveBanks = selectedNewIds.every(pid => sigPartnerSelections[pid]?.bank);
                                    if (!allHaveBanks) { setDealMsg("Select a sponsor bank for each partner first"); setTimeout(() => setDealMsg(""), 3000); return; }
                                    reuseBatchSignature(d.id, signedSession, selectedNewIds);
                                  }}
                                  disabled={sigSending}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                                >
                                  {sigSending ? "Processing..." : `Reuse Signature for ${selectedNewIds.length} Partner${selectedNewIds.length > 1 ? "s" : ""}`}
                                </button>
                                <span className="text-xs text-slate-400">or request a new signature below</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 2: MPA Fields */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
                        <h4 className="text-sm font-semibold text-slate-900">Review Pre-Filled MPA Fields</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {mpaChecks.map(check => (
                          <div key={check.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${check.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            <span>{check.ok ? "\u2713" : "\u26A0"}</span>
                            <span className="font-medium">{check.label}</span>
                            {!check.ok && check.missing.length > 0 && <span className="text-[10px] opacity-75">({check.missing.join(", ")})</span>}
                          </div>
                        ))}
                      </div>
                      {sigTemplate?.extra_fields && typeof sigTemplate.extra_fields === "object" && Object.keys(sigTemplate.extra_fields).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs text-slate-500 mb-2 font-medium">Additional MPA Fields</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(sigTemplate.extra_fields).map(([key, def]) => (
                              <div key={key}>
                                <label className="text-xs text-slate-500 block mb-1">{key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</label>
                                <input type="text" value={(d.mpa_extra_field_values || {})[key] || ""} onChange={(e) => { if (isActiveDeal) updateDealField("mpa_extra_field_values", { ...(d.mpa_extra_field_values || {}), [key]: e.target.value }); }} className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 3: Send new signature */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
                        <h4 className="text-sm font-semibold text-slate-900">Request New Signature</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Signer Name</label>
                          <input type="text" value={sigSignerName} onChange={(e) => setSigSignerName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Signer Email</label>
                          <input type="email" value={sigSignerEmail} onChange={(e) => setSigSignerEmail(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Link Expires</label>
                          <select value={sigExpiry} onChange={(e) => setSigExpiry(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500">
                            <option value="3">3 days</option>
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                          </select>
                        </div>
                      </div>
                      {mpaResult.blockingCount > 0 ? (
                        <div className="mt-3">
                          <button disabled className="bg-slate-300 text-slate-500 px-5 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed">Send for Signature</button>
                          <p className="text-xs text-red-500 mt-2">{mpaResult.blockingCount} blocking issue{mpaResult.blockingCount > 1 ? "s" : ""} must be resolved before sending. Review the MPA Readiness section on the Overview tab.</p>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {mpaResult.warningCount > 0 && <p className="text-xs text-amber-500 mb-2">{mpaResult.warningCount} warning{mpaResult.warningCount > 1 ? "s" : ""} — you can still send, but review recommended.</p>}
                          {mpaResult.blockingCount === 0 && mpaResult.warningCount === 0 && <p className="text-xs text-emerald-600 mb-2">All MPA fields complete — ready to send</p>}
                          <button
                            onClick={() => {
                              const selectedNew = Object.keys(sigPartnerSelections).filter(pid => !getSignedPartnerIds(d.id).has(pid));
                              if (selectedNew.length > 0) {
                                const allHaveBanks = selectedNew.every(pid => sigPartnerSelections[pid]?.bank);
                                if (!allHaveBanks) { setDealMsg("Select a sponsor bank for each partner first"); setTimeout(() => setDealMsg(""), 3000); return; }
                                sendBatchForSignature(d.id);
                              } else {
                                sendForSignature(d.id);
                              }
                            }}
                            disabled={sigSending || !sigSignerEmail || !sigSignerName || Object.keys(sigPartnerSelections).filter(pid => !getSignedPartnerIds(d.id).has(pid)).length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                          >
                            {sigSending ? "Sending..." : "Request New Signature"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission History Timeline */}
                  {sessions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <button onClick={() => setSigHistoryOpen(!sigHistoryOpen)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 font-medium transition">
                        <svg className={`w-3 h-3 transition-transform ${sigHistoryOpen ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        Submission History ({sessions.length})
                      </button>
                      {sigHistoryOpen && (
                        <div className="mt-3 space-y-2">
                          {sessions.map((s: any, sIdx: number) => {
                            const pStatus = s.partner_id && d.partner_submission_status?.[s.partner_id]?.status;
                            return (
                            <div key={s.id} className="flex items-start gap-3 text-xs">
                              <div className="flex flex-col items-center">
                                <span className={`w-2 h-2 rounded-full mt-1.5 ${s.decline_note ? "bg-red-400" : s.status === "signed" ? "bg-emerald-500" : s.status === "pending" ? "bg-blue-500" : s.status === "expired" ? "bg-slate-300" : "bg-red-400"}`} />
                                {sIdx < sessions.length - 1 && <div className="w-px h-6 bg-slate-200 mt-1" />}
                              </div>
                              <div className="flex-1 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-slate-700">
                                    {s.partner_id ? getPartnerNameById(s.partner_id) : "Unknown Partner"}
                                    <span className="text-slate-400 mx-1">&mdash;</span>
                                    <span className={s.decline_note ? "text-red-500" : s.status === "signed" ? "text-emerald-600" : s.status === "pending" ? "text-blue-600" : "text-slate-400"}>
                                      {s.decline_note ? "Declined" : s.status === "signed" ? "Signed" : s.status === "pending" ? "Pending Signature" : s.status === "expired" ? "Expired" : "Revoked"}
                                    </span>
                                    {s.reused_from_session_id && <span className="text-slate-400 ml-1">(reused)</span>}
                                  </p>
                                  {s.status === "signed" && s.partner_id && canEdit && (
                                    <select
                                      value={pStatus || "signed"}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => updatePartnerSubmissionStatus(s.partner_id, e.target.value)}
                                      className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600"
                                    >
                                      {partnerStatusOptions.map(opt => <option key={opt} value={opt}>{opt.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                                    </select>
                                  )}
                                </div>
                                <p className="text-slate-400">
                                  {s.status === "signed" && s.signed_at ? `Signed ${new Date(s.signed_at).toLocaleDateString()}` : `Sent ${new Date(s.created_at).toLocaleDateString()}`}
                                  {s.decline_note && <span className="text-red-400 ml-1">({s.decline_note})</span>}
                                </p>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {deals.length > 0 && ["qualified_prospect", "send_for_signature", "signed", "submitted", "converted"].includes(lead.status) && (
          <>
            {/* Location / Deal header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">{deals.length > 1 ? "Locations / Deals" : "Deal Details"}</h3>
                {deal?.updated_at && <p className="text-slate-400 text-xs mt-1">Deal last modified: {new Date(deal.updated_at).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-3">
                {dealMsg && <span className="text-emerald-600 text-sm">{dealMsg}</span>}
                {canEdit && <button onClick={async () => { await saveDeal(); await saveOwners(); }} disabled={dealSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{dealSaving ? "Saving..." : "Save Deal"}</button>}
              </div>
            </div>

            {/* Multi-location tabs */}
            {deals.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {deals.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-0.5">
                    <button
                      onClick={() => setActiveDealIdx(i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${i === activeDealIdx ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                    >
                      {d.is_primary_location && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>}
                      {d.location_name || d.dba_name || `Location ${i + 1}`}
                      {d.monthly_volume ? <span className="text-xs opacity-75 ml-1">${Number(d.monthly_volume).toLocaleString()}/mo</span> : null}
                    </button>
                    {canEdit && !d.is_primary_location && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteLocationTarget(d); }}
                        className="p-1 text-slate-300 hover:text-red-500 transition"
                        title="Delete location"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button onClick={() => setShowAddLocation(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-600 border border-dashed border-emerald-300 hover:bg-emerald-50 transition">+ Add Location</button>
                )}
              </div>
            )}

            {/* Location-specific fields for multi-deal */}
            {deals.length > 1 && deal && (
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                <h4 className="font-semibold text-emerald-600 mb-3">Location Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs text-slate-500 block mb-1">Location Name</label><input type="text" value={deal.location_name || ""} onChange={(e) => updateDealField("location_name", e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500" /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">Location Street</label><input type="text" value={deal.location_street || ""} onChange={(e) => updateDealField("location_street", e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500" /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">City</label><input type="text" value={deal.location_city || ""} onChange={(e) => updateDealField("location_city", e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500" /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">State</label><input type="text" value={deal.location_state || ""} onChange={(e) => updateDealField("location_state", e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500" /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">Zip</label><input type="text" value={deal.location_zip || ""} onChange={(e) => updateDealField("location_zip", e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500" /></div>
                  <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!deal.is_primary_location} onChange={(e) => updateDealField("is_primary_location", e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /> Primary Location</label></div>
                </div>
              </div>
            )}

            {/* Single-deal: small add location link */}
            {deals.length === 1 && canEdit && (
              <div className="mb-4">
                <button onClick={() => setShowAddLocation(true)} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">+ Add Location</button>
              </div>
            )}

            {/* Partner Selection moved to top card pricing section */}

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <div><label className={labelClass}>Business Phone</label><input type="tel" value={deal.business_phone || ""} onChange={(e) => updateDealField("business_phone", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Business Email</label><input type="email" value={deal.business_email || ""} onChange={(e) => updateDealField("business_email", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Customer Service Phone (for CNP)</label><input type="tel" value={deal.customer_service_phone || ""} onChange={(e) => updateDealField("customer_service_phone", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <div><label className={labelClass}>Business Start Date</label><input type="date" value={deal.business_start_date || ""} onChange={(e) => updateDealField("business_start_date", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Length of Current Ownership</label><input type="text" value={deal.length_of_ownership || ""} onChange={(e) => updateDealField("length_of_ownership", e.target.value)} className={inputClass} placeholder="e.g. 5 years" /></div>
                    <div><label className={labelClass}>Number of Employees</label><input type="number" value={deal.number_of_employees ?? ""} onChange={(e) => updateDealField("number_of_employees", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <div><label className={labelClass}>MCC Code</label><input type="text" value={deal.mcc_code || ""} onChange={(e) => updateDealField("mcc_code", e.target.value)} className={inputClass} placeholder="e.g. 5812 - Eating Places, Restaurants" /></div>
                    <div><label className={labelClass}>SIC Code</label><input type="text" value={deal.sic_code || ""} onChange={(e) => updateDealField("sic_code", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Annual Revenue</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span><input type="number" value={deal.annual_revenue ?? ""} onChange={(e) => updateDealField("annual_revenue", e.target.value)} className={inputClass + " pl-7"} /></div></div>
                  </div>
                  <div className="mt-4"><label className={labelClass}>Products/Services Description</label><textarea rows={3} value={deal.products_services_description || ""} onChange={(e) => updateDealField("products_services_description", e.target.value)} className={inputClass + " resize-none"} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div><label className={labelClass}>Business License Number</label><input type="text" value={deal.business_license_number || ""} onChange={(e) => updateDealField("business_license_number", e.target.value)} className={inputClass} /></div>
                    <div className="flex items-center gap-3 pt-7">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.seasonal_business} onChange={(e) => updateDealField("seasonal_business", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">Seasonal Business</span></label>
                    </div>
                  </div>
                  {deal.seasonal_business && (
                    <div className="mt-4"><label className={labelClass}>Seasonal Months</label><input type="text" value={deal.seasonal_months || ""} onChange={(e) => updateDealField("seasonal_months", e.target.value)} className={inputClass} placeholder="e.g. June - August" /></div>
                  )}
                  <div className="mt-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.mailing_address_different} onChange={(e) => updateDealField("mailing_address_different", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">Mailing address different from legal address</span></label>
                  </div>
                  {deal.mailing_address_different && (
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div><label className={labelClass}>Mailing Street</label><input type="text" value={deal.mailing_street || ""} onChange={(e) => updateDealField("mailing_street", e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Mailing City</label><input type="text" value={deal.mailing_city || ""} onChange={(e) => updateDealField("mailing_city", e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Mailing State</label><select value={deal.mailing_state || ""} onChange={(e) => updateDealField("mailing_state", e.target.value)} className={inputClass}><option value="">Select...</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                      <div><label className={labelClass}>Mailing Zip</label><input type="text" value={deal.mailing_zip || ""} onChange={(e) => updateDealField("mailing_zip", e.target.value)} className={inputClass} /></div>
                    </div>
                  )}
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
                  {["llc", "corp", "s_corp", "partnership"].includes(deal.entity_type || "") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div><label className={labelClass}>State of Incorporation</label><select value={deal.state_of_incorporation || ""} onChange={(e) => updateDealField("state_of_incorporation", e.target.value)} className={inputClass}><option value="">Select...</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>
                  )}
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Transaction Info</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={labelClass}>Card Present %</label>
                      <input type="number" min="0" max="100" value={deal.cp_pct ?? ""} onChange={(e) => handleCpChange(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Card Not Present %</label>
                      <input type="number" min="0" max="100" value={deal.cnp_pct ?? ""} onChange={(e) => handleCnpChange(e.target.value)} className={inputClass} />
                      <p className="text-xs text-slate-400 mt-1">Must total 100%</p>
                    </div>
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
                  {/* Cross-field validations */}
                  {(() => {
                    const warnings: React.ReactNode[] = [];
                    const ht = Number(deal.high_ticket) || 0;
                    const at = Number(deal.average_ticket) || 0;
                    const mv = Number(deal.monthly_volume) || 0;
                    const mt = Number(deal.monthly_transactions) || 0;
                    if (ht > 0 && at > 0 && ht < at) warnings.push(<p key="ht" className="text-xs text-red-500 mt-2">High ticket (${ht}) should be &ge; average ticket (${at})</p>);
                    if (mv > 0 && mt > 0) { const calc = (mv / mt).toFixed(2); warnings.push(<p key="calc" className="text-xs text-slate-400 mt-2">Calculated avg ticket: ${calc} (volume &divide; transactions)</p>); }
                    return warnings;
                  })()}
                </div>

                <div className={sectionClass}>
                  <h4 className="font-semibold mb-4 text-emerald-600">Processing Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div><label className={labelClass}>Current Processor MID</label><input type="text" value={deal.current_mid || ""} onChange={(e) => updateDealField("current_mid", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Monthly Transactions</label><input type="number" value={deal.monthly_transactions ?? ""} onChange={(e) => updateDealField("monthly_transactions", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Annual Card Volume</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span><input type="number" value={deal.annual_card_volume ?? ""} onChange={(e) => updateDealField("annual_card_volume", e.target.value)} className={inputClass + " pl-7"} /></div></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div><label className={labelClass}>Amex SE Number</label><input type="text" value={deal.amex_se_number || ""} onChange={(e) => updateDealField("amex_se_number", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Discover MID</label><input type="text" value={deal.discover_mid || ""} onChange={(e) => updateDealField("discover_mid", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>B2B Percentage</label><input type="number" min="0" max="100" value={deal.pct_b2b ?? ""} onChange={(e) => updateDealField("pct_b2b", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div><label className={labelClass}>International Cards %</label><input type="number" min="0" max="100" value={deal.international_cards_pct ?? ""} onChange={(e) => updateDealField("international_cards_pct", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="mt-4"><label className={labelClass}>Reason for Leaving Current Processor</label><textarea rows={2} value={deal.reason_for_leaving || ""} onChange={(e) => updateDealField("reason_for_leaving", e.target.value)} className={inputClass + " resize-none"} /></div>
                  {Number(deal.cnp_pct) > 0 && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-700 mb-3">CNP Breakdown</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div><label className={labelClass}>Internet %</label><input type="number" min="0" max="100" value={deal.pct_internet ?? ""} onChange={(e) => updateDealField("pct_internet", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Mail Order %</label><input type="number" min="0" max="100" value={deal.pct_mail_order ?? ""} onChange={(e) => updateDealField("pct_mail_order", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Telephone Order %</label><input type="number" min="0" max="100" value={deal.pct_telephone_order ?? ""} onChange={(e) => updateDealField("pct_telephone_order", e.target.value)} className={inputClass} /></div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-3 pt-7">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.recurring_billing} onChange={(e) => updateDealField("recurring_billing", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">Recurring Billing</span></label>
                    </div>
                    {deal.recurring_billing && (
                      <div><label className={labelClass}>Frequency</label><select value={deal.recurring_frequency || ""} onChange={(e) => updateDealField("recurring_frequency", e.target.value)} className={inputClass}><option value="">Select...</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select></div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div><label className={labelClass}>Days between charge and delivery</label><input type="number" value={deal.fulfillment_timeframe_days ?? ""} onChange={(e) => updateDealField("fulfillment_timeframe_days", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Delivery Method</label><select value={deal.delivery_method || ""} onChange={(e) => updateDealField("delivery_method", e.target.value)} className={inputClass}><option value="">Select...</option><option value="digital">Digital/Download</option><option value="physical_shipping">Physical Shipping</option><option value="in_person_pickup">In-Person Pickup</option><option value="service_no_delivery">Service/No Delivery</option></select></div>
                  </div>
                  <div className="mt-4"><label className={labelClass}>Refund Policy</label><textarea rows={2} value={deal.refund_policy_text || ""} onChange={(e) => updateDealField("refund_policy_text", e.target.value)} className={inputClass + " resize-none"} /></div>
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
                  {(() => {
                    const totalPct = owners.reduce((s, o) => s + (Number(o.ownership_pct) || 0), 0);
                    const hasControlPerson = owners.some(o => !!o.is_control_prong);
                    return (
                      <>
                        {owners.length > 0 && (
                          <div className="flex items-center gap-4 mb-3 text-sm">
                            <span className={`font-medium ${totalPct === 100 ? "text-emerald-600" : "text-red-500"}`}>
                              {totalPct === 100 ? "✓" : "!"} Ownership: {totalPct}%
                            </span>
                            {owners.length > 0 && !hasControlPerson && <span className="text-amber-600 text-xs">No control person designated</span>}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                        <div>
                          <label className={labelClass}>SSN</label>
                          <div className="relative">
                            {revealedSsns[idx] !== undefined ? (
                              <input
                                type="text"
                                value={revealedSsns[idx]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateOwner(idx, "_ssn_plain", val);
                                  setRevealedSsns(prev => ({ ...prev, [idx]: val }));
                                }}
                                className={inputClass + " pr-10"}
                                placeholder="###-##-####"
                              />
                            ) : (
                              <input
                                type="password"
                                value={o.ssn_encrypted ? "••••••••••" : o._ssn_plain || ""}
                                onChange={(e) => {
                                  updateOwner(idx, "_ssn_plain", e.target.value);
                                }}
                                className={inputClass + " pr-10"}
                                placeholder="•••-••-####"
                                readOnly={!!o.ssn_encrypted && !o._ssn_plain}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => toggleSsnVisibility(idx)}
                              disabled={revealingIdx === idx}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm disabled:opacity-50"
                              title={revealedSsns[idx] !== undefined ? "Hide SSN" : "Show SSN"}
                            >
                              {revealingIdx === idx ? "⏳" : revealedSsns[idx] !== undefined ? "🙈" : "👁"}
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">🔒 Encrypted</p>
                        </div>
                        <div><label className={labelClass}>Phone</label><input type="tel" value={o.phone || ""} onChange={(e) => updateOwner(idx, "phone", e.target.value)} className={inputClass} /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                        <div><label className={labelClass}>Email</label><input type="email" value={o.email || ""} onChange={(e) => updateOwner(idx, "email", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>DL State</label><select value={o.dl_state || ""} onChange={(e) => updateOwner(idx, "dl_state", e.target.value)} className={inputClass}><option value="">Select...</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div>
                          <label className={labelClass}>DL Expiration Date</label>
                          <input type="date" value={o.dl_expiration || ""} onChange={(e) => updateOwner(idx, "dl_expiration", e.target.value)} className={inputClass} />
                          {o.dl_expiration && new Date(o.dl_expiration) < new Date() && <p className="text-xs text-red-500 mt-0.5">Expired</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mb-3">
                        <div><label className={labelClass}>Address</label><input type="text" value={o.address || ""} onChange={(e) => updateOwner(idx, "address", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>City</label><input type="text" value={o.city || ""} onChange={(e) => updateOwner(idx, "city", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>State</label><select value={o.state || ""} onChange={(e) => updateOwner(idx, "state", e.target.value)} className={inputClass}><option value="">Select...</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div><label className={labelClass}>Zip</label><input type="text" value={o.zip || ""} onChange={(e) => updateOwner(idx, "zip", e.target.value)} className={inputClass} /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                        <div><label className={labelClass}>Citizenship</label><input type="text" value={o.citizenship ?? "US"} onChange={(e) => updateOwner(idx, "citizenship", e.target.value)} className={inputClass} /></div>
                        <div className="flex items-center gap-3 pt-7">
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={o.is_us_resident !== false} onChange={(e) => updateOwner(idx, "is_us_resident", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">US Resident</span></label>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 pt-3 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!o.is_control_prong} onChange={(e) => updateOwner(idx, "is_control_prong", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-xs text-slate-700">Control Person (FinCEN CDD)</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!o.personal_guarantee} onChange={(e) => updateOwner(idx, "personal_guarantee", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-xs text-slate-700">Personal Guarantee</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!o.prior_bankruptcies} onChange={(e) => updateOwner(idx, "prior_bankruptcies", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-xs text-slate-700">Prior Bankruptcies</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!o.criminal_history} onChange={(e) => updateOwner(idx, "criminal_history", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-xs text-slate-700">Criminal History</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!o.match_tmf_listed} onChange={(e) => updateOwner(idx, "match_tmf_listed", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-xs text-slate-700">MATCH/TMF Listed</span></label>
                      </div>
                      {o.match_tmf_listed && <p className="text-xs text-red-500 mt-2 bg-red-50 rounded p-2">Prior MATCH listing must be disclosed — undisclosed listings cause auto-decline</p>}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div><label className={labelClass}>Bank Phone</label><input type="tel" value={deal.bank_phone || ""} onChange={(e) => updateDealField("bank_phone", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Bank Account Holder Name</label><input type="text" value={deal.bank_account_holder_name || ""} onChange={(e) => updateDealField("bank_account_holder_name", e.target.value)} className={inputClass} /><p className="text-xs text-slate-400 mt-0.5">Must match DBA or Legal Name</p></div>
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
                            {signedUrls[doc.id] ? (
                              <a href={signedUrls[doc.id]} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 hover:text-slate-900 transition">{doc.file_name}</a>
                            ) : (
                              <span className="text-sm text-slate-400">{doc.file_name} <span className="text-xs">(link expired, refresh to regenerate)</span></span>
                            )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div><label className={labelClass}>PCI Compliance Status</label><select value={deal.pci_compliance_status || ""} onChange={(e) => updateDealField("pci_compliance_status", e.target.value)} className={inputClass}><option value="">Select...</option><option value="compliant">Compliant</option><option value="non_compliant">Non-Compliant</option><option value="in_progress">In Progress</option><option value="not_started">Not Started</option></select></div>
                    <div><label className={labelClass}>PCI Compliance Vendor</label><input type="text" value={deal.pci_compliance_vendor || ""} onChange={(e) => updateDealField("pci_compliance_vendor", e.target.value)} className={inputClass} placeholder="e.g. SecurityMetrics, Trustwave" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div><label className={labelClass}>Beneficial Ownership Certified</label><input type="date" value={deal.beneficial_ownership_certified || ""} onChange={(e) => updateDealField("beneficial_ownership_certified", e.target.value)} className={inputClass} /></div>
                    <div className="flex items-center gap-3 pt-7">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.ach_debit_authorized} onChange={(e) => updateDealField("ach_debit_authorized", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">ACH Debit Authorized</span></label>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* eCommerce Section — conditional on CNP > 0 */}
            {Number(deal.cnp_pct) > 0 && (
              <>
                <div onClick={() => toggleGroup("groupEcom")} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.groupEcom ? "border-l-4 border-l-emerald-500" : ""}`}>
                  <h3 className="text-lg font-semibold text-slate-700">eCommerce</h3>
                  <span className={`text-slate-400 transition-transform duration-200 ${openGroups.groupEcom ? "rotate-180" : ""}`}>▼</span>
                </div>
                <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.groupEcom ? "5000px" : "0px", opacity: openGroups.groupEcom ? 1 : 0 }}>
                  <div className="space-y-6 mb-6">
                    <div className={sectionClass}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.ssl_certificate} onChange={(e) => updateDealField("ssl_certificate", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">SSL Certificate</span></label>
                        </div>
                        <div><label className={labelClass}>Shopping Cart Platform</label><input type="text" value={deal.shopping_cart_platform || ""} onChange={(e) => updateDealField("shopping_cart_platform", e.target.value)} className={inputClass} placeholder="e.g. Shopify, WooCommerce" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.stores_card_data} onChange={(e) => updateDealField("stores_card_data", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">Stores Card Data</span></label>
                          {deal.stores_card_data && <p className="text-xs text-red-500 mt-1 bg-red-50 rounded p-2">Storing card data increases PCI scope significantly</p>}
                        </div>
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.three_d_secure_enabled} onChange={(e) => updateDealField("three_d_secure_enabled", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">3D Secure Enabled</span></label>
                        </div>
                      </div>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!deal.negative_option_billing} onChange={(e) => updateDealField("negative_option_billing", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /><span className="text-sm text-slate-700">Negative Option Billing</span></label>
                        {deal.negative_option_billing && <p className="text-xs text-amber-600 mt-1 bg-amber-50 rounded p-2">This is a high-risk flag for underwriting</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {canEdit && (
              <div className="flex justify-end mb-8">
                <button type="button" onClick={async () => { await saveDeal(); await saveOwners(); }} disabled={dealSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50">{dealSaving ? "Saving..." : "Save Deal"}</button>
              </div>
            )}
          </>
        )}
        </>)}

        {/* ═══════════ DOCUMENTS TAB ═══════════ */}
        {leadTab === "Documents" && (<>
        {/* ═══════════ DOCUMENT UPLOAD & LIST ═══════════ */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Documents</h3>
            <div className="flex items-center gap-2">
              <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="">Select category...</option>
                {docTypes.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
              </select>
              <label className={`${!selectedDocType || uploading || !deal ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition inline-block`}>
                {uploading ? 'Uploading...' : 'Upload Document'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  disabled={!selectedDocType || uploading || !deal}
                  onChange={async (e) => { if (!deal) { await ensureDeal(); } handleFileUpload(e); }}
                />
              </label>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">No documents uploaded yet.</p>
              <p className="text-slate-400 text-xs mt-1">Upload processing statements, IDs, bank letters and other deal documents.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500 text-xs">
                    <th className="pb-2 pr-4 font-medium">File Name</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc: any) => (
                    <tr key={doc.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-4 text-slate-700 font-medium">{doc.file_name}</td>
                      <td className="py-2.5 pr-4"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{docTypeLabel(doc.doc_type)}</span></td>
                      <td className="py-2.5 pr-4 text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={async () => { const url = signedUrls[doc.id] || await getSignedUrl(doc.file_url); if (url) window.open(url, '_blank'); }} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View</button>
                          <button onClick={() => deleteDocument(doc)} className="text-xs text-red-400 hover:text-red-500 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════ SIGNED DOCUMENTS ═══════════ */}
        {["signed", "submitted", "converted", "send_for_signature"].includes(lead.status) && (() => {
          const allSessions = Object.values(sigSessions).flat().filter((s: any) => s.status === "signed");
          if (allSessions.length === 0) return null;
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Signed Documents</h3>
              <div className="divide-y divide-slate-100">
                {allSessions.map((s: any) => {
                  const dealForSession = deals.find(d => d.id === s.deal_id);
                  const docs = getSessionDocs(s.id);
                  const certDoc = docs.find((d: any) => d.document_type === "signature_certificate");
                  const mpaDoc = docs.find((d: any) => d.document_type === "mpa_summary");
                  return (
                    <div key={s.id} className="py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.signer_name}</p>
                          <p className="text-xs text-slate-500">{s.signer_email}{dealForSession ? ` \u00b7 ${dealForSession.location_name || dealForSession.dba_name || ""}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{new Date(s.signed_at).toLocaleString()}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Signed</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {certDoc && signedDocUrls[certDoc.id] && (
                          <a href={signedDocUrls[certDoc.id]} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Signature Certificate</a>
                        )}
                        {mpaDoc && signedDocUrls[mpaDoc.id] && (
                          <a href={signedDocUrls[mpaDoc.id]} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">MPA Summary</a>
                        )}
                        {s.signature_data && (
                          <button onClick={() => {
                            const a = document.createElement("a");
                            a.href = s.signature_data;
                            a.download = `signature-${s.signer_name.replace(/\s+/g, "-")}.png`;
                            a.click();
                          }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Signature PNG</button>
                        )}
                        {(!certDoc || !mpaDoc) && (
                          <button
                            onClick={() => regeneratePdfs(s.id)}
                            disabled={regenerating === s.id}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                          >
                            {regenerating === s.id ? "Generating..." : "Generate PDFs"}
                          </button>
                        )}
                        {certDoc && mpaDoc && (
                          <button
                            onClick={() => regeneratePdfs(s.id)}
                            disabled={regenerating === s.id}
                            className="text-xs text-slate-400 hover:text-slate-600 font-medium disabled:opacity-50"
                          >
                            {regenerating === s.id ? "Regenerating..." : "Regenerate"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      </>)}

      {/* ═══════════ ACTIVITY TAB ═══════════ */}
      {leadTab === "Activity" && (<>
      {/* ═══════════ REP CODES SECTION ═══════════ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Agent Rep Codes</h3>
        {!lead.assigned_to ? (
          <p className="text-sm text-slate-400">Assign an agent to this lead to see their rep codes.</p>
        ) : agentRepCodes.length === 0 ? (
          <p className="text-sm text-slate-400">No rep codes assigned to this agent. <Link href="/dashboard/settings" className="text-emerald-600 hover:text-emerald-700">Manage rep codes in Settings &rarr; Team.</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Partner</th>
                  <th className="pb-2 pr-4 font-medium">Rep Code</th>
                  <th className="pb-2 pr-4 font-medium">Label</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Split %</th>
                  <th className="pb-2 font-medium">Code Type</th>
                </tr>
              </thead>
              <tbody>
                {agentRepCodes.map((rc) => (
                  <tr key={rc.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-700">{repCodePartners[rc.partner_id] || "—"}</td>
                    <td className="py-2 pr-4 font-mono text-slate-600">{rc.rep_code || "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{rc.label || "—"}</td>
                    <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{rc.status || "—"}</span></td>
                    <td className="py-2 pr-4 text-slate-700">{rc.split_pct != null ? `${rc.split_pct}%` : "—"}</td>
                    <td className="py-2 text-slate-600">{rc.code_type || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
      </>)}
      </div>

      {/* Communication History slide-out panel */}
      {showCommPanel && (
        <div className="fixed inset-0 z-40" onClick={() => setShowCommPanel(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-xl border-l border-slate-200 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Communication History</h3>
              <button onClick={() => setShowCommPanel(false)} className="text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CommunicationLog
                leadId={lead.id}
                dealId={deal?.id}
                contactName={lead.contact_name}
                contactPhone={lead.phone}
                contactEmail={lead.email}
                onTaskCreated={fetchTasks}
                hideActionBar
              />
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => updateStatus("submitted", {})} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition">Continue to Application</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "declined" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Mark as Declined</h3>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-500 block mb-1">Reason</label><input type="text" value={modalData.reason} onChange={(e) => setModalData({ ...modalData, reason: e.target.value })} placeholder="Reason for decline" className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <button onClick={() => updateStatus("declined", { declined_reason: modalData.reason })} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Saving..." : "Confirm"}</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "resubmit_from_declined" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Resubmit to Different Partner?</h3>
            <p className="text-slate-500 text-sm mb-4">Move back to Send for Signature to submit to a different partner? The previous signature session will be preserved for audit trail.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={async () => {
                setSaving(true);
                // Add decline note to existing signed sessions for this lead
                const allSessions = Object.values(sigSessions).flat();
                const previousPartnerName = deal?.partner_id ? getPartnerNameById(deal.partner_id) : "previous partner";
                const reason = lead.declined_reason ? ` — ${lead.declined_reason}` : "";
                for (const s of allSessions) {
                  if (s.status === "signed" && !s.decline_note) {
                    await supabase.from("signature_sessions").update({
                      decline_note: `Declined by ${previousPartnerName}${reason}`
                    }).eq("id", s.id);
                  }
                }
                await updateStatus("send_for_signature", {});
                setSaving(false);
              }} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Processing..." : "Move to Send for Signature"}</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {sigSnapshotWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-lg mx-4">
            <h3 className="text-lg font-bold mb-2 text-amber-600">Business Data Changed</h3>
            <p className="text-slate-500 text-sm mb-3">Business data has changed since the original signature. A new signature is recommended.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              <ul className="text-xs text-amber-800 space-y-1">
                {sigSnapshotWarning.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={() => reuseSignature(deal.id, sigSnapshotWarning.originalSession)} disabled={sigSending} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{sigSending ? "Processing..." : "Proceed Anyway"}</button>
              <button onClick={() => setSigSnapshotWarning(null)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition">Request New Signature</button>
              <button onClick={() => setSigSnapshotWarning(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Upload Modal */}
      {showStatementModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowStatementModal(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Upload Processing Statement</h3>
            <p className="text-sm text-slate-500 mb-4">Upload a processing statement (PDF or CSV) for analysis.</p>
            <label className={`${statementUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition inline-block`}>
              {statementUploading ? "Uploading..." : "Choose File"}
              <input type="file" className="hidden" accept=".pdf,.csv" onChange={handleStatementUpload} disabled={statementUploading} />
            </label>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowStatementModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "backward_from_signed" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Move Backward?</h3>
            <p className="text-slate-500 text-sm mb-4">Moving backward from {statusLabel(lead.status)} will remove the associated merchant record. The deal data will be preserved.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={confirmBackwardFromSigned} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Processing..." : "Confirm"}</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "signed" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Convert {deal?.location_name || deal?.dba_name || "Location"} to Merchant</h3>
            <p className="text-slate-500 text-sm mb-4">This will create a new merchant account from {deals.length > 1 ? "this location's" : "this lead's"} deal information.</p>
            {deals.length > 1 && <p className="text-xs text-slate-400 mb-4">Each location converts independently. {deals.length > 1 ? `${deals.length} total locations.` : ""}</p>}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={convertToMerchant} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">{saving ? "Creating..." : "Confirm & Create Merchant"}</button>
              <button onClick={() => setShowModal("")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showBelowCostWarning && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-amber-600 mb-3">Pricing Below Partner Costs</h3>
            <p className="text-sm text-slate-500 mb-4">The following fields are priced below your partner&apos;s buy rates:</p>
            <div className="bg-amber-50 rounded-lg p-3 mb-4">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-amber-700"><th className="pb-1">Field</th><th className="pb-1">Your Rate</th><th className="pb-1">Partner Cost</th><th className="pb-1">Diff</th></tr></thead>
                <tbody>
                  {belowCostItems.map((item, i) => (
                    <tr key={i} className="text-amber-800">
                      <td className="py-0.5">{item.label}</td>
                      <td>{item.sell}</td>
                      <td>{item.buy}</td>
                      <td className="text-red-600 font-medium">{(item.sell - item.buy).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowBelowCostWarning(false); setPendingStageAfterWarning(""); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Go Back and Fix</button>
              <button onClick={() => { setShowBelowCostWarning(false); updateStatus(pendingStageAfterWarning, {}); setPendingStageAfterWarning(""); }} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Proceed Anyway</button>
            </div>
          </div>
        </div>
      )}

      {showApplyConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowApplyConfirm(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Apply Template &ldquo;{showApplyConfirm.name}&rdquo;?</h3>
            <p className="text-sm text-slate-500">This will overwrite current pricing, fees, hardware, and software fields.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowApplyConfirm(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={() => applyTemplate(showApplyConfirm)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Apply Template</button>
            </div>
          </div>
        </div>
      )}

      {showSaveAsTpl && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSaveAsTpl(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Save as Pricing Template</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500 block mb-1">Template Name *</label><input type="text" value={saveTplName} onChange={e => setSaveTplName(e.target.value)} placeholder="e.g. Standard IC+ Pricing" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveTplDefault} onChange={e => setSaveTplDefault(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /> Set as default for new leads</label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowSaveAsTpl(false); setSaveTplName(''); setSaveTplDefault(false); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={saveAsTemplate} disabled={saveTplSaving || !saveTplName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">{saveTplSaving ? 'Saving...' : 'Save Template'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddLocation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddLocation(false)}>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add New Location</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Location Name <span className="text-red-400">*</span></label>
                <input type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder="e.g. Downtown Branch" className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500" />
              </div>
              {deals.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Copy pricing from</label>
                  <select value={copyFromDealId} onChange={(e) => setCopyFromDealId(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 w-full bg-white text-slate-700 focus:outline-none focus:border-emerald-500">
                    <option value="">Start fresh</option>
                    {deals.map((d, i) => (
                      <option key={d.id} value={d.id}>{d.location_name || d.dba_name || `Location ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddLocation(false); setNewLocationName(""); setCopyFromDealId(""); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={addLocation} disabled={saving || !newLocationName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">{saving ? "Creating..." : "Add Location"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteLocationTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !deletingLocation && setDeleteLocationTarget(null)}>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-red-600 mb-3">Delete {deleteLocationTarget.location_name || deleteLocationTarget.dba_name || "Location"}?</h3>
            <p className="text-sm text-slate-600">This will permanently delete this location&apos;s deal, pricing, hardware, software, and document data. This can&apos;t be undone.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteLocationTarget(null)} disabled={deletingLocation} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={deleteLocation} disabled={deletingLocation} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">{deletingLocation ? "Deleting..." : "Delete Location"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Partner switch modal removed — simplified pricing */}
    </div>
  );
}
