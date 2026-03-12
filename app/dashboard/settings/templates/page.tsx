"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface Template {
  id: string;
  user_id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  created_at: string;
}

const CATEGORY_BADGES: Record<string, string> = {
  prospecting: "bg-blue-50 text-blue-700",
  follow_up: "bg-amber-50 text-amber-700",
  onboarding: "bg-emerald-50 text-emerald-700",
  general: "bg-slate-100 text-slate-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  follow_up: "Follow Up",
  onboarding: "Onboarding",
  general: "General",
};

const DEFAULT_TEMPLATES = [
  {
    name: "Initial Outreach",
    category: "prospecting",
    subject: "Saving {{business_name}} money on payment processing",
    body: "Hi {{contact_name}},\n\nI came across {{business_name}} and wanted to reach out. Many businesses in your industry are overpaying on processing fees without realizing it.\n\nI'd love to do a free, no-obligation analysis of your current processing statement to see if we can save you money.\n\nWould you have 15 minutes this week for a quick call?\n\nBest,\n{{agent_name}}",
  },
  {
    name: "Follow Up",
    category: "follow_up",
    subject: "Following up — {{business_name}} processing review",
    body: "Hi {{contact_name}},\n\nI wanted to follow up on my previous message about reviewing {{business_name}}'s payment processing costs.\n\nEven a quick look at your most recent statement can reveal savings opportunities. Happy to work around your schedule.\n\nBest,\n{{agent_name}}",
  },
  {
    name: "Welcome / Onboarding",
    category: "onboarding",
    subject: "Welcome to {{business_name}} — next steps",
    body: "Hi {{contact_name}},\n\nWelcome aboard! We're excited to have {{business_name}} as a new merchant.\n\nHere are your next steps:\n1. Your new terminal/gateway will be set up within 2-3 business days\n2. Your first statement will arrive at the end of the month\n3. If you have any questions, don't hesitate to reach out\n\nBest,\n{{agent_name}}",
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Editor state
  const [edName, setEdName] = useState("");
  const [edCategory, setEdCategory] = useState("general");
  const [edSubject, setEdSubject] = useState("");
  const [edBody, setEdBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");

      if (data && data.length === 0) {
        // Seed default templates
        const seeds = DEFAULT_TEMPLATES.map((t) => ({ ...t, user_id: user.id }));
        const { data: seeded } = await supabase
          .from("email_templates")
          .insert(seeds)
          .select();
        setTemplates(seeded || []);
      } else {
        setTemplates(data || []);
      }

      setLoading(false);
    };
    init();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    setTemplates(data || []);
  };

  const startNew = () => {
    setEditing(null);
    setIsNew(true);
    setEdName("");
    setEdCategory("general");
    setEdSubject("");
    setEdBody("");
    setMsg("");
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setIsNew(true);
    setEdName(t.name);
    setEdCategory(t.category);
    setEdSubject(t.subject);
    setEdBody(t.body);
    setMsg("");
  };

  const cancelEdit = () => {
    setIsNew(false);
    setEditing(null);
    setMsg("");
  };

  const handleSave = async () => {
    if (!edName.trim()) { setMsg("Template name is required"); return; }
    setSaving(true);
    setMsg("");

    if (editing) {
      const { error } = await supabase
        .from("email_templates")
        .update({ name: edName, category: edCategory, subject: edSubject, body: edBody })
        .eq("id", editing.id);
      if (error) { setMsg("Error: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("email_templates")
        .insert({ user_id: userId, name: edName, category: edCategory, subject: edSubject, body: edBody });
      if (error) { setMsg("Error: " + error.message); setSaving(false); return; }
    }

    await fetchTemplates();
    setIsNew(false);
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("email_templates").delete().eq("id", id);
    await fetchTemplates();
  };

  const inputClass = "w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-base";
  const labelClass = "text-sm text-slate-600 font-medium block mb-1.5";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-2">
          <Link href="/dashboard/settings" className="text-slate-400 hover:text-slate-900 text-sm transition">{"\u2190"} Back to Settings</Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">Email Templates</h2>
            <p className="text-slate-500 mt-1">Create reusable templates for common emails</p>
          </div>
          {!isNew && (
            <button onClick={startNew} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
              + New Template
            </button>
          )}
        </div>

        <div className="max-w-3xl">
          {/* EDITOR */}
          {isNew && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">{editing ? "Edit Template" : "New Template"}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Template Name</label>
                    <input type="text" value={edName} onChange={(e) => setEdName(e.target.value)} className={inputClass} placeholder="e.g. Initial Outreach" />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select value={edCategory} onChange={(e) => setEdCategory(e.target.value)} className={inputClass}>
                      <option value="prospecting">Prospecting</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Subject</label>
                  <input type="text" value={edSubject} onChange={(e) => setEdSubject(e.target.value)} className={inputClass} placeholder="Email subject line" />
                  <p className="text-xs text-slate-400 mt-1">Merge tags: {"{{business_name}}"}, {"{{contact_name}}"}, {"{{agent_name}}"}</p>
                </div>
                <div>
                  <label className={labelClass}>Body</label>
                  <textarea value={edBody} onChange={(e) => setEdBody(e.target.value)} className={`${inputClass} resize-none`} rows={10} placeholder="Email body..." />
                  <p className="text-xs text-slate-400 mt-1">Merge tags: {"{{business_name}}"}, {"{{contact_name}}"}, {"{{agent_name}}"}</p>
                </div>

                {msg && (
                  <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{msg}</p>
                )}

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                  <button onClick={cancelEdit} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50">
                    {saving ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE LIST */}
          {loading ? (
            <p className="text-slate-500">Loading templates...</p>
          ) : templates.length === 0 && !isNew ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <p className="text-slate-500 text-lg mb-4">No templates yet</p>
              <button onClick={startNew} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-150">
                Create Your First Template
              </button>
            </div>
          ) : (
            <div>
              {templates.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-900">{t.name}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGES[t.category] || CATEGORY_BADGES.general}`}>
                        {CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => startEdit(t)} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-600 text-sm font-medium">Delete</button>
                    </div>
                  </div>
                  {t.subject && <p className="text-sm text-slate-500">{t.subject}</p>}
                  {t.body && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{t.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
