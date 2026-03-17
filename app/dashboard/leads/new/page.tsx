"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";

export default function NewLeadPage() {
  const router = useRouter();
  const { user, member, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [assignTo, setAssignTo] = useState("");

  const role = member?.role || "";
  const isOwnerOrManager = role === "owner" || role === "manager";

  useEffect(() => {
    if (authLoading || !user) return;
    if (!isOwnerOrManager) {
      setAssignTo(user.id);
      return;
    }
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("org_members")
        .select("user_id, role, invited_email, status")
        .eq("org_id", member.org_id)
        .eq("status", "active");
      if (data) {
        const withProfiles = await Promise.all(
          data.filter(m => m.user_id).map(async (m) => {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("full_name")
              .eq("user_id", m.user_id)
              .maybeSingle();
            return { ...m, full_name: profile?.full_name || m.invited_email || "Unknown" };
          })
        );
        setOrgMembers(withProfiles);
      }
    };
    fetchMembers();
  }, [authLoading, user?.id, member?.org_id]);
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    monthly_volume: "",
    status: "new_prospect",
    notes: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.business_name.trim()) {
      setError("Business name is required");
      return;
    }
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data, error: insertError } = await supabase.from("leads").insert({
      user_id: user.id,
      org_id: member?.org_id || null,
      assigned_to: assignTo || user.id,
      business_name: form.business_name,
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone,
      website: form.website || null,
      monthly_volume: form.monthly_volume ? parseFloat(form.monthly_volume) : null,
      status: form.status,
      notes: form.notes,
    }).select("id").single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      supabase.from('user_onboarding').update({ first_lead_added: true, updated_at: new Date().toISOString() }).eq('user_id', user.id)
      router.push("/dashboard/leads/" + data.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <Link href="/dashboard/leads" className="text-slate-400 hover:text-slate-900 text-sm transition">← Back to Leads</Link>
          <h2 className="text-xl lg:text-2xl font-bold mt-2">Add New Lead</h2>
        </div>

        <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm max-w-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-base text-slate-500 block mb-1">Business Name *</label>
                <input type="text" value={form.business_name} onChange={(e) => updateField("business_name", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="ABC Coffee Shop" />
              </div>
              <div>
                <label className="text-base text-slate-500 block mb-1">Contact Name</label>
                <input type="text" value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="John Smith" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-base text-slate-500 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="john@example.com" />
              </div>
              <div>
                <label className="text-base text-slate-500 block mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="(555) 123-4567" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-base text-slate-500 block mb-1">Website</label>
                <input type="text" value={form.website} onChange={(e) => updateField("website", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="https://example.com" />
              </div>
              <div>
                <label className="text-base text-slate-500 block mb-1">Est. Monthly Volume</label>
                <input type="number" value={form.monthly_volume} onChange={(e) => updateField("monthly_volume", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="25000" />
              </div>
              <div>
                <label className="text-base text-slate-500 block mb-1">Status</label>
                <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                  <option value="new_prospect">New Prospect</option>
                  <option value="contact_pending">Contact Pending</option>
                  <option value="pending_qualification">Pending Qualification</option>
                  <option value="qualified_prospect">Qualified Prospect</option>
                  <option value="send_for_signature">Send for Signature</option>
                  <option value="signed">Signed</option>
                  <option value="submitted">Submitted</option>
                  <option value="declined">Declined</option>
                  <option value="unqualified">Unqualified</option>
                  <option value="unresponsive">Unresponsive</option>
                  <option value="recycled">Recycled</option>
                </select>
              </div>
            </div>

            {isOwnerOrManager && orgMembers.length > 0 && (
              <div>
                <label className="text-base text-slate-500 block mb-1">Assign To</label>
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Myself</option>
                  {orgMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-base text-slate-500 block mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-32 resize-none" placeholder="Additional details about this lead..." />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50">
                {loading ? "Saving..." : "Save Lead"}
              </button>
              <Link href="/dashboard/leads" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-medium transition">Cancel</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
