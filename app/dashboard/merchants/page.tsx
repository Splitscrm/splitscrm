"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ExportCSV from "@/components/ExportCSV";
import { useAuth } from "@/lib/auth-context";

const MERCHANT_EXPORT_COLUMNS = [
  { key: "business_name", label: "Business Name" },
  { key: "contact_name", label: "Contact Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "mid", label: "MID" },
  { key: "processor", label: "Processor" },
  { key: "monthly_volume", label: "Monthly Volume" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Created" },
];

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  inactive: "bg-red-50 text-red-700",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
};

interface MerchantFilters {
  statuses: Set<string>;
  processor: string;
  assignedTo: string;
  dateFrom: string;
  dateTo: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  state: string;
  mid: string;
  volumeMin: string;
  volumeMax: string;
  hasMid: string;
  pricingType: string;
  chargebackMin: string;
  chargebackMax: string;
}

const emptyFilters: MerchantFilters = {
  statuses: new Set(),
  processor: "",
  assignedTo: "",
  dateFrom: "",
  dateTo: "",
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  state: "",
  mid: "",
  volumeMin: "",
  volumeMax: "",
  hasMid: "",
  pricingType: "",
  chargebackMin: "",
  chargebackMax: "",
};

function countActiveFilters(f: MerchantFilters): number {
  let n = 0;
  if (f.statuses.size > 0) n++;
  if (f.processor) n++;
  if (f.assignedTo) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.businessName) n++;
  if (f.contactName) n++;
  if (f.email) n++;
  if (f.phone) n++;
  if (f.state) n++;
  if (f.mid) n++;
  if (f.volumeMin || f.volumeMax) n++;
  if (f.hasMid) n++;
  if (f.pricingType) n++;
  if (f.chargebackMin || f.chargebackMax) n++;
  return n;
}

export default function MerchantsPage() {
  const router = useRouter();
  const { user, member, loading: authLoading } = useAuth();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MerchantFilters>({ ...emptyFilters, statuses: new Set() });
  const [orgMembers, setOrgMembers] = useState<{ id: string; name: string }[]>([]);
  const [processors, setProcessors] = useState<string[]>([]);

  const role = member?.role || "";
  const isOwnerOrManager = role === "owner" || role === "manager";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchMerchants();
    fetchOrgMembers();
  }, [authLoading, user?.id]);

  const fetchMerchants = async () => {
    if (!user) return;
    let query = supabase
      .from("merchants")
      .select("id, business_name, contact_name, email, phone, mid, processor, status, monthly_volume, assigned_to, user_id, created_at, business_state, pricing_type, chargeback_ratio, notes")
      .order("created_at", { ascending: false });

    if (!isOwnerOrManager) {
      query = query.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
    }

    const { data } = await query;
    if (data) {
      setMerchants(data);
      // Extract unique processors for the filter dropdown
      const procs = [...new Set(data.map((m: any) => m.processor).filter(Boolean))] as string[];
      setProcessors(procs.sort());
    }
    setLoading(false);
  };

  const fetchOrgMembers = async () => {
    if (!member?.org_id) return;
    const { data: members } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", member.org_id)
      .not("user_id", "is", null);
    if (!members) return;
    const userIds = members.map((m: any) => m.user_id);
    if (userIds.length === 0) return;
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);
    if (profiles) {
      setOrgMembers(profiles.map((p: any) => ({
        id: p.user_id,
        name: p.full_name || p.email || p.user_id.slice(0, 8),
      })));
    }
  };

  const activeFilterCount = countActiveFilters(filters);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = merchants.filter((m) => {
      // Global search
      const matchSearch = !q ||
        (m.business_name || "").toLowerCase().includes(q) ||
        (m.contact_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.mid || "").toLowerCase().includes(q) ||
        (m.processor || "").toLowerCase().includes(q);

      // Status dropdown (legacy quick access)
      const matchStatusDropdown = statusFilter === "all" || m.status === statusFilter;

      // Advanced filters
      const f = filters;

      const matchStatuses = f.statuses.size === 0 || f.statuses.has(m.status);
      const matchProcessor = !f.processor || m.processor === f.processor;
      const matchAssigned = !f.assignedTo || m.assigned_to === f.assignedTo;

      const createdDate = m.created_at ? new Date(m.created_at) : null;
      const matchDateFrom = !f.dateFrom || (createdDate && createdDate >= new Date(f.dateFrom));
      const matchDateTo = !f.dateTo || (createdDate && createdDate <= new Date(f.dateTo + "T23:59:59"));

      const matchBusiness = !f.businessName || (m.business_name || "").toLowerCase().includes(f.businessName.toLowerCase());
      const matchContact = !f.contactName || (m.contact_name || "").toLowerCase().includes(f.contactName.toLowerCase());
      const matchEmail = !f.email || (m.email || "").toLowerCase().includes(f.email.toLowerCase());
      const matchPhone = !f.phone || (m.phone || "").includes(f.phone);
      const matchState = !f.state || (m.business_state || "").toLowerCase().includes(f.state.toLowerCase());
      const matchMidText = !f.mid || (m.mid || "").toLowerCase().includes(f.mid.toLowerCase());

      const vol = Number(m.monthly_volume) || 0;
      const matchVolMin = !f.volumeMin || vol >= Number(f.volumeMin);
      const matchVolMax = !f.volumeMax || vol <= Number(f.volumeMax);

      const matchHasMid = !f.hasMid ||
        (f.hasMid === "yes" && !!m.mid) ||
        (f.hasMid === "no" && !m.mid);

      const matchPricing = !f.pricingType || m.pricing_type === f.pricingType;

      const ratio = Number(m.chargeback_ratio) || 0;
      const matchCbMin = !f.chargebackMin || ratio >= Number(f.chargebackMin);
      const matchCbMax = !f.chargebackMax || ratio <= Number(f.chargebackMax);

      return matchSearch && matchStatusDropdown && matchStatuses && matchProcessor &&
        matchAssigned && matchDateFrom && matchDateTo && matchBusiness && matchContact &&
        matchEmail && matchPhone && matchState && matchMidText && matchVolMin && matchVolMax &&
        matchHasMid && matchPricing && matchCbMin && matchCbMax;
    });

    switch (sort) {
      case "oldest":
        result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "name_az":
        result = [...result].sort((a, b) => (a.business_name || "").localeCompare(b.business_name || ""));
        break;
      case "volume_desc":
        result = [...result].sort((a, b) => (Number(b.monthly_volume) || 0) - (Number(a.monthly_volume) || 0));
        break;
      default:
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [merchants, search, statusFilter, sort, filters]);

  const updateFilter = <K extends keyof MerchantFilters>(key: K, value: MerchantFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleStatus = (status: string) => {
    setFilters(prev => {
      const next = new Set(prev.statuses);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return { ...prev, statuses: next };
    });
  };

  const clearFilters = () => {
    setFilters({ ...emptyFilters, statuses: new Set() });
  };

  const inputClass = "bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900";
  const filterInputClass = "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">Merchants</h2>
            <p className="text-slate-500 mt-1">{merchants.length} total merchants</p>
          </div>
          <Link href="/dashboard/merchants/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">+ Add Merchant</Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="text"
              placeholder="Search merchants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full sm:flex-1 ${inputClass}`}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
                showFilters || activeFilterCount > 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full sm:w-auto ${inputClass}`}
            >
              <option value="all">All Statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`w-full sm:w-auto ${inputClass}`}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name_az">Business Name A-Z</option>
              <option value="volume_desc">Volume High-Low</option>
            </select>
            <span className="text-base text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            <ExportCSV data={filtered} filename="merchants-export" columns={MERCHANT_EXPORT_COLUMNS} />
          </div>

          {/* Advanced Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700">Advanced Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Clear All Filters</button>
                )}
              </div>

              {/* Status checkboxes */}
              <div className="mb-4">
                <label className="text-xs text-slate-500 block mb-1.5">Status</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <label key={value} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full cursor-pointer border transition ${
                      filters.statuses.has(value)
                        ? `${statusColors[value]} border-current`
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}>
                      <input
                        type="checkbox"
                        checked={filters.statuses.has(value)}
                        onChange={() => toggleStatus(value)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Processor */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Processor</label>
                  <select
                    value={filters.processor}
                    onChange={(e) => updateFilter("processor", e.target.value)}
                    className={filterInputClass}
                  >
                    <option value="">All</option>
                    {processors.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Assigned To</label>
                  <select
                    value={filters.assignedTo}
                    onChange={(e) => updateFilter("assignedTo", e.target.value)}
                    className={filterInputClass}
                  >
                    <option value="">All</option>
                    {orgMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date range */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Created From</label>
                  <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} className={filterInputClass} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Created To</label>
                  <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} className={filterInputClass} />
                </div>

                {/* Business Name */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Business Name</label>
                  <input type="text" value={filters.businessName} onChange={(e) => updateFilter("businessName", e.target.value)} placeholder="Contains..." className={filterInputClass} />
                </div>

                {/* Contact Name */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Contact Name</label>
                  <input type="text" value={filters.contactName} onChange={(e) => updateFilter("contactName", e.target.value)} placeholder="Contains..." className={filterInputClass} />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Email</label>
                  <input type="text" value={filters.email} onChange={(e) => updateFilter("email", e.target.value)} placeholder="Contains..." className={filterInputClass} />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Phone</label>
                  <input type="text" value={filters.phone} onChange={(e) => updateFilter("phone", e.target.value)} placeholder="Contains..." className={filterInputClass} />
                </div>

                {/* MID */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">MID</label>
                  <input type="text" value={filters.mid} onChange={(e) => updateFilter("mid", e.target.value)} placeholder="Contains..." className={filterInputClass} />
                </div>

                {/* State */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">State/Region</label>
                  <input type="text" value={filters.state} onChange={(e) => updateFilter("state", e.target.value)} placeholder="e.g. CA" className={filterInputClass} />
                </div>

                {/* Volume range */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Volume Min ($)</label>
                  <input type="number" value={filters.volumeMin} onChange={(e) => updateFilter("volumeMin", e.target.value)} placeholder="0" className={filterInputClass} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Volume Max ($)</label>
                  <input type="number" value={filters.volumeMax} onChange={(e) => updateFilter("volumeMax", e.target.value)} placeholder="No limit" className={filterInputClass} />
                </div>

                {/* Has MID */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Has MID</label>
                  <select value={filters.hasMid} onChange={(e) => updateFilter("hasMid", e.target.value)} className={filterInputClass}>
                    <option value="">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Pricing Type */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Pricing Type</label>
                  <select value={filters.pricingType} onChange={(e) => updateFilter("pricingType", e.target.value)} className={filterInputClass}>
                    <option value="">Any</option>
                    <option value="ic_plus">IC+</option>
                    <option value="dual_pricing">Dual Pricing</option>
                    <option value="flat_rate">Flat Rate</option>
                  </select>
                </div>

                {/* Chargeback ratio range */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">CB Ratio Min (%)</label>
                  <input type="number" step="0.01" value={filters.chargebackMin} onChange={(e) => updateFilter("chargebackMin", e.target.value)} placeholder="0" className={filterInputClass} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">CB Ratio Max (%)</label>
                  <input type="number" step="0.01" value={filters.chargebackMax} onChange={(e) => updateFilter("chargebackMax", e.target.value)} placeholder="No limit" className={filterInputClass} />
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500">Loading merchants...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-lg mb-4">{merchants.length === 0 ? "No merchants yet" : "No matching merchants"}</p>
            {merchants.length === 0 && (
              <Link href="/dashboard/merchants/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Add Your First Merchant</Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-base text-slate-500 font-medium">Business</th>
                  <th className="text-left px-6 py-4 text-base text-slate-500 font-medium">Contact</th>
                  <th className="text-left px-6 py-4 text-base text-slate-500 font-medium">Processor</th>
                  <th className="text-left px-6 py-4 text-base text-slate-500 font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-base text-slate-500 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => router.push(`/dashboard/merchants/${m.id}`)} onMouseEnter={() => router.prefetch(`/dashboard/merchants/${m.id}`)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-base">{m.business_name}</p>
                      <p className="text-sm text-slate-500">{m.email}</p>
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600">{m.contact_name}</td>
                    <td className="px-6 py-4 text-base text-slate-600">{m.processor || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[m.status] || "bg-slate-100 text-slate-600"}`}>{m.status}</span>
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600">{m.monthly_volume ? `$${m.monthly_volume.toLocaleString()}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
