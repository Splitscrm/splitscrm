"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ExportCSV from "@/components/ExportCSV";
import { useAuth } from "@/lib/auth-context";

const PARTNER_EXPORT_COLUMNS = [
  { key: "name", label: "Partner Name" },
  { key: "contact_name", label: "Contact Name" },
  { key: "email", label: "Email" },
  { key: "relationship_manager", label: "Relationship Manager" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
];

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-red-50 text-red-700",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
};

export default function PartnersPage() {
  const router = useRouter();
  const { user, member, loading: authLoading } = useAuth();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const role = member?.role || "";
  const isOwnerOrManager = role === "owner" || role === "manager";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isOwnerOrManager) {
      router.push("/dashboard");
      return;
    }
    const fetchPartners = async () => {
      const { data } = await supabase
        .from("partners")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setPartners(data);
      setLoading(false);
    };
    fetchPartners();
  }, [authLoading, user?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = partners.filter((p) => {
      const matchSearch = !q ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.contact_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.relationship_manager || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });

    switch (sort) {
      case "oldest":
        result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "name_az":
        result = [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [partners, search, statusFilter, sort]);

  const inputClass = "bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">Partners</h2>
            <p className="text-slate-500 mt-1">{partners.length} total partners</p>
          </div>
          <Link href="/dashboard/partners/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">+ Add Partner</Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search partners..."
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
            <option value="name_az">Name A-Z</option>
          </select>
          <span className="text-sm text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          <ExportCSV data={filtered} filename="partners-export" columns={PARTNER_EXPORT_COLUMNS} />
        </div>

        {loading ? (
          <p className="text-slate-500">Loading partners...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-lg mb-4">{partners.length === 0 ? "No partners yet" : "No matching partners"}</p>
            {partners.length === 0 && (
              <Link href="/dashboard/partners/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Add Your First Partner</Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Partner Name</th>
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Relationship Manager</th>
                  <th className="text-left px-6 py-4 text-sm text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/dashboard/partners/${p.id}`)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition">
                    <td className="px-6 py-4 font-medium">{p.name}</td>
                    <td className="px-6 py-4 text-slate-600">{p.relationship_manager || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                    </td>
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
