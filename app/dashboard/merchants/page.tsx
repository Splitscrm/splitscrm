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

export default function MerchantsPage() {
  const router = useRouter();
  const { user, member, loading: authLoading } = useAuth();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const role = member?.role || "";
  const isOwnerOrManager = role === "owner" || role === "manager";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    const fetchMerchants = async () => {
      let query = supabase
        .from("merchants")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isOwnerOrManager) {
        query = query.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      }

      const { data } = await query;
      if (data) setMerchants(data);
      setLoading(false);
    };
    fetchMerchants();
  }, [authLoading, user?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = merchants.filter((m) => {
      const matchSearch = !q ||
        (m.business_name || "").toLowerCase().includes(q) ||
        (m.contact_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.mid || "").toLowerCase().includes(q) ||
        (m.processor || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || m.status === statusFilter;
      return matchSearch && matchStatus;
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
  }, [merchants, search, statusFilter, sort]);

  const inputClass = "bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900";

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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search merchants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full sm:flex-1 ${inputClass}`}
          />
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
          <span className="text-sm text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          <ExportCSV data={filtered} filename="merchants-export" columns={MERCHANT_EXPORT_COLUMNS} />
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
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Business</th>
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Contact</th>
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Processor</th>
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => router.push(`/dashboard/merchants/${m.id}`)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition">
                    <td className="px-6 py-4">
                      <p className="font-medium">{m.business_name}</p>
                      <p className="text-sm text-slate-500">{m.email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{m.contact_name}</td>
                    <td className="px-6 py-4 text-slate-600">{m.processor || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[m.status] || "bg-slate-100 text-slate-600"}`}>{m.status}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{m.monthly_volume ? `$${m.monthly_volume.toLocaleString()}` : "-"}</td>
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
