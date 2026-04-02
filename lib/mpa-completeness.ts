export type SectionStatus = "complete" | "warning" | "missing" | "not_started";

export interface MpaSection {
  name: string;
  tab: string; // which leadTab to switch to
  status: SectionStatus;
  missingFields: string[];
  isBlocking: boolean;
}

export interface MpaCompletenessResult {
  overallPercent: number;
  sections: MpaSection[];
  blockingCount: number;
  warningCount: number;
}

export function checkMpaCompleteness(
  deal: any,
  owners: any[],
  documents: any[]
): MpaCompletenessResult {
  if (!deal) {
    return { overallPercent: 0, sections: [], blockingCount: 0, warningCount: 0 };
  }

  const sections: MpaSection[] = [];

  // ── BUSINESS INFO (blocking) ──
  {
    const missing: string[] = [];
    if (!deal.business_legal_name) missing.push("Business Legal Name");
    if (!deal.dba_name) missing.push("DBA Name");
    if (!deal.legal_street) missing.push("Legal Street");
    if (!deal.legal_city) missing.push("Legal City");
    if (!deal.legal_state) missing.push("Legal State");
    if (!deal.legal_zip) missing.push("Legal Zip");
    if (!deal.entity_type) missing.push("Entity Type");
    if (!deal.ein_itin) missing.push("EIN/ITIN");
    if (!deal.mcc_code) missing.push("MCC Code");
    if (!deal.business_start_date) missing.push("Business Start Date");
    if (!deal.business_phone) missing.push("Business Phone");
    sections.push({
      name: "Business Information",
      tab: "DealInfo",
      status: missing.length === 0 ? "complete" : missing.length >= 6 ? "not_started" : "missing",
      missingFields: missing,
      isBlocking: true,
    });
  }

  // ── OWNERS (blocking) ──
  {
    const missing: string[] = [];
    if (owners.length === 0) {
      missing.push("At least 1 owner required");
    } else {
      for (let i = 0; i < owners.length; i++) {
        const o = owners[i];
        const prefix = owners.length > 1 ? `Owner ${i + 1}: ` : "";
        if (!o.full_name) missing.push(prefix + "Full Name");
        if (!o.ownership_pct) missing.push(prefix + "Ownership %");
        if (!o.ssn_encrypted && !o._ssn_plain) missing.push(prefix + "SSN");
        if (!o.dob) missing.push(prefix + "Date of Birth");
        if (!o.address) missing.push(prefix + "Address");
        if (!o.city) missing.push(prefix + "City");
        if (!o.state) missing.push(prefix + "State");
        if (!o.zip) missing.push(prefix + "Zip");
      }
      const totalPct = owners.reduce((s: number, o: any) => s + (Number(o.ownership_pct) || 0), 0);
      if (totalPct !== 100) missing.push(`Ownership total is ${totalPct}% (must be 100%)`);
      const hasControl = owners.some((o: any) => !!o.is_control_prong);
      if (!hasControl) missing.push("No control person designated");
    }
    sections.push({
      name: "Ownership",
      tab: "Ownership",
      status: missing.length === 0 ? "complete" : owners.length === 0 ? "not_started" : "missing",
      missingFields: missing,
      isBlocking: true,
    });
  }

  // ── PROCESSING (blocking) ──
  {
    const missing: string[] = [];
    if (!deal.monthly_volume) missing.push("Monthly Volume");
    if (!deal.average_ticket) missing.push("Average Ticket");
    const cpPct = Number(deal.cp_pct) || 0;
    const cnpPct = Number(deal.cnp_pct) || 0;
    if (cpPct + cnpPct !== 100) missing.push("CP% + CNP% must total 100%");
    sections.push({
      name: "Processing Info",
      tab: "DealInfo",
      status: missing.length === 0 ? "complete" : !deal.monthly_volume && !deal.average_ticket ? "not_started" : "missing",
      missingFields: missing,
      isBlocking: true,
    });
  }

  // ── BANKING (blocking) ──
  {
    const missing: string[] = [];
    if (!deal.bank_routing) missing.push("Routing Number");
    if (!deal.bank_account) missing.push("Account Number");
    if (!deal.bank_account_holder_name) missing.push("Account Holder Name");
    sections.push({
      name: "Banking",
      tab: "DealInfo",
      status: missing.length === 0 ? "complete" : !deal.bank_routing && !deal.bank_account ? "not_started" : "missing",
      missingFields: missing,
      isBlocking: true,
    });
  }

  // ── PRICING (blocking) ──
  {
    const missing: string[] = [];
    if (!deal.pricing_type) missing.push("Pricing Type");
    else {
      if (deal.pricing_type === "interchange_plus" && !deal.ic_plus_visa_pct) missing.push("IC+ Visa Rate");
      if (deal.pricing_type === "dual_pricing" && !deal.dual_pricing_rate) missing.push("Dual Pricing Rate");
      if (deal.pricing_type === "flat_rate" && !deal.flat_rate_pct) missing.push("Flat Rate %");
    }
    sections.push({
      name: "Pricing",
      tab: "Pricing",
      status: missing.length === 0 ? "complete" : !deal.pricing_type ? "not_started" : "missing",
      missingFields: missing,
      isBlocking: true,
    });
  }

  // ── DOCUMENTS (warning) ──
  {
    const missing: string[] = [];
    const hasVoidedCheck = documents.some((d: any) => d.doc_type === "voided_check");
    const hasBankLetter = documents.some((d: any) => d.doc_type === "bank_letter");
    if (!hasVoidedCheck && !hasBankLetter) missing.push("Voided check or bank letter");
    sections.push({
      name: "Documents",
      tab: "Documents",
      status: missing.length === 0 ? "complete" : "warning",
      missingFields: missing,
      isBlocking: false,
    });
  }

  // ── OWNER WARNINGS (warning) ──
  {
    const warnings: string[] = [];
    const now = new Date();
    for (let i = 0; i < owners.length; i++) {
      const o = owners[i];
      if (o.dl_expiration && new Date(o.dl_expiration) < now) {
        warnings.push(`Owner ${i + 1}: DL expired`);
      }
    }
    if (warnings.length > 0) {
      sections.push({
        name: "Owner Warnings",
        tab: "Ownership",
        status: "warning",
        missingFields: warnings,
        isBlocking: false,
      });
    }
  }

  // ── eCOMMERCE (warning, only if CNP > 0) ──
  if (Number(deal.cnp_pct) > 0) {
    const warnings: string[] = [];
    if (!deal.ssl_certificate) warnings.push("SSL Certificate not confirmed");
    if (!deal.refund_policy_text) warnings.push("Refund Policy");
    if (warnings.length > 0) {
      sections.push({
        name: "eCommerce",
        tab: "DealInfo",
        status: "warning",
        missingFields: warnings,
        isBlocking: false,
      });
    }
  }

  // ── BUSINESS LICENSE (warning) ──
  if (!deal.business_license_number) {
    sections.push({
      name: "Business License",
      tab: "DealInfo",
      status: "warning",
      missingFields: ["Business License Number"],
      isBlocking: false,
    });
  }

  // ── Calculate totals ──
  const blockingCount = sections.filter(s => s.isBlocking && s.status !== "complete").reduce((s, sec) => s + sec.missingFields.length, 0);
  const warningCount = sections.filter(s => !s.isBlocking && s.status !== "complete").reduce((s, sec) => s + sec.missingFields.length, 0);

  const totalSections = sections.filter(s => s.isBlocking).length;
  const completeSections = sections.filter(s => s.isBlocking && s.status === "complete").length;
  const overallPercent = totalSections > 0 ? Math.round((completeSections / totalSections) * 100) : 0;

  return { overallPercent, sections, blockingCount, warningCount };
}

/**
 * Get tab-level status for status dots on tab headers.
 * Returns "green" | "amber" | "red" | null
 */
export function getTabStatus(
  tabKey: string,
  result: MpaCompletenessResult
): "green" | "amber" | "red" | null {
  const tabSections = result.sections.filter(s => s.tab === tabKey);
  if (tabSections.length === 0) return null;

  const hasBlocking = tabSections.some(s => s.isBlocking && s.status !== "complete");
  const hasWarning = tabSections.some(s => !s.isBlocking && s.status !== "complete");

  if (hasBlocking) return "red";
  if (hasWarning) return "amber";
  return "green";
}
