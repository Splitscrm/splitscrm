"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import TaskModal from "@/components/TaskModal";

interface CommunicationLogProps {
  leadId?: string;
  merchantId?: string;
  dealId?: string;
  linkedLeadId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  onTaskCreated?: () => void;
}

interface Communication {
  id: string;
  type: string;
  direction: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  subject: string;
  body: string;
  duration_seconds: number;
  logged_at: string;
  lead_id: string | null;
  merchant_id: string | null;
}

const TYPE_CONFIG: Record<string, { icon: string; bg: string; label: string }> = {
  call: { icon: "\uD83D\uDCDE", bg: "bg-blue-50", label: "Call" },
  email: { icon: "\u2709\uFE0F", bg: "bg-emerald-50", label: "Email" },
  sms: { icon: "\uD83D\uDCAC", bg: "bg-purple-50", label: "SMS" },
  note: { icon: "\uD83D\uDCDD", bg: "bg-amber-50", label: "Note" },
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDuration(seconds: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CommunicationLog({
  leadId,
  merchantId,
  dealId,
  linkedLeadId,
  contactName = "",
  contactPhone = "",
  contactEmail = "",
  onTaskCreated,
}: CommunicationLogProps) {
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [modal, setModal] = useState<"call" | "email" | "note" | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Modal state
  const [direction, setDirection] = useState("outbound");
  const [modalName, setModalName] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalSubject, setModalSubject] = useState("");
  const [modalBody, setModalBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const fetchComms = useCallback(async () => {
    if (!leadId && !merchantId) { setLoading(false); return; }

    if (merchantId && linkedLeadId) {
      // Fetch both merchant and linked lead communications
      const [merchantRes, leadRes] = await Promise.all([
        supabase.from("communications").select("id, type, direction, contact_name, subject, body, duration_seconds, logged_at, lead_id, merchant_id").eq("merchant_id", merchantId),
        supabase.from("communications").select("id, type, direction, contact_name, subject, body, duration_seconds, logged_at, lead_id, merchant_id").eq("lead_id", linkedLeadId),
      ]);
      const merged = [...(merchantRes.data || []), ...(leadRes.data || [])];
      // Deduplicate by id, then sort by logged_at desc
      const unique = Array.from(new Map(merged.map((c) => [c.id, c])).values());
      unique.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
      setComms(unique);
    } else {
      let query = supabase.from("communications").select("id, type, direction, contact_name, subject, body, duration_seconds, logged_at, lead_id, merchant_id").order("logged_at", { ascending: false });
      if (leadId) query = query.eq("lead_id", leadId);
      else if (merchantId) query = query.eq("merchant_id", merchantId);
      const { data } = await query;
      setComms(data || []);
    }

    setLoading(false);
  }, [leadId, merchantId, linkedLeadId]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: tpls } = await supabase
          .from("email_templates")
          .select("id, name, subject, body")
          .eq("user_id", user.id)
          .order("name");
        if (tpls) setTemplates(tpls);
      }
      await fetchComms();
    };
    init();
  }, [fetchComms]);

  const openModal = (type: "call" | "email" | "note") => {
    setModal(type);
    setDirection(type === "email" ? "sent" : "outbound");
    setModalName(contactName);
    setModalPhone(contactPhone);
    setModalEmail(contactEmail);
    setModalSubject("");
    setModalBody("");
    setSelectedTemplate("");
  };

  const logActivity = async (description: string) => {
    await supabase.from("activity_log").insert({
      user_id: userId,
      lead_id: leadId || null,
      merchant_id: merchantId || null,
      deal_id: dealId || null,
      action_type: "communication_logged",
      description,
    });
  };

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);

    const record: Record<string, any> = {
      user_id: userId,
      lead_id: leadId || null,
      merchant_id: merchantId || null,
      deal_id: dealId || null,
      type: modal,
      direction: modal === "note" ? null : direction,
      contact_name: modalName || null,
      contact_email: modal === "email" ? (modalEmail || null) : null,
      contact_phone: modal === "call" ? (modalPhone || null) : null,
      subject: modal === "email" ? (modalSubject || null) : null,
      body: modalBody || null,
      duration_seconds: null,
      logged_at: new Date().toISOString(),
    };

    await supabase.from("communications").insert(record);

    // Activity log
    if (modal === "call") {
      await logActivity(`Call logged: ${direction} call with ${modalName || "unknown"}`);
    } else if (modal === "email") {
      await logActivity(`Email logged: ${direction} — ${modalSubject || "(no subject)"}`);
    } else {
      await logActivity(`Note added${modalName ? ` for ${modalName}` : ""}`);
    }

    setModal(null);
    setSaving(false);
    await fetchComms();
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setModalSubject(tpl.subject);
      setModalBody(tpl.body);
    }
  };

  const inputClass = "w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm";
  const labelClass = "text-sm text-slate-600 font-medium block mb-1.5";
  const btnBase = "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150";

  return (
    <div>
      {/* ACTION BAR */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => openModal("call")} className={btnBase}>
            <span className="mr-1.5">{"\uD83D\uDCDE"}</span>Log Call
          </button>
          {contactPhone && (
            <a
              href={`tel:${contactPhone}`}
              onClick={(e) => {
                navigator.clipboard.writeText(contactPhone).then(() => {
                  setPhoneCopied(true);
                  setTimeout(() => setPhoneCopied(false), 2000);
                });
              }}
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              {phoneCopied ? "Copied!" : contactPhone}
            </a>
          )}
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              onClick={(e) => { e.preventDefault(); window.open(`mailto:${contactEmail}`); setTimeout(() => openModal("email"), 1000); }}
              className={btnBase}
            >
              <span className="mr-1.5">{"\u2709\uFE0F"}</span>Send Email
            </a>
          ) : (
            <span className={`${btnBase} opacity-50 cursor-not-allowed`} title="No email on file">
              <span className="mr-1.5">{"\u2709\uFE0F"}</span>Send Email
            </span>
          )}
          <button onClick={() => openModal("note")} className={btnBase}>
            <span className="mr-1.5">{"\uD83D\uDCDD"}</span>Add Note
          </button>
          <button onClick={() => setShowTaskModal(true)} className={btnBase}>
            <span className="mr-1.5">📋</span>Follow-up
          </button>
        </div>
      </div>

      {/* COMMUNICATION TIMELINE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">Communication History</h4>

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : comms.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No communications yet. Log a call, send an email, or add a note to get started.
          </p>
        ) : (
          <div className="relative">
            {comms.map((c, idx) => {
              const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.note;
              const isExpanded = expanded[c.id];
              const bodyLong = c.body && c.body.length > 200;

              return (
                <div key={c.id} className="flex gap-3 relative">
                  {/* Vertical line */}
                  {idx < comms.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 border-l-2 border-slate-100" />
                  )}

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 text-sm z-10`}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{cfg.label}</span>
                      {c.direction && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{c.direction}</span>
                      )}
                      {c.contact_name && <span className="text-sm text-slate-600">— {c.contact_name}</span>}
                      {c.type === "call" && c.duration_seconds > 0 && (
                        <span className="text-xs text-slate-400">{formatDuration(c.duration_seconds)}</span>
                      )}
                    </div>

                    {c.type === "email" && c.subject && (
                      <p className="text-sm text-slate-700 mt-0.5">{c.subject}</p>
                    )}

                    {c.body && (
                      <div className="mt-1">
                        <p className={`text-sm text-slate-500 whitespace-pre-wrap ${!isExpanded && bodyLong ? "line-clamp-3" : ""}`}>
                          {c.body}
                        </p>
                        {bodyLong && (
                          <button
                            onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="text-xs text-emerald-600 hover:text-emerald-700 mt-1"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-400">{relativeTime(c.logged_at)}</p>
                      {linkedLeadId && c.lead_id && !c.merchant_id && (
                        <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">From Lead</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSaved={async () => {
            await logActivity("Follow-up task created");
            onTaskCreated?.();
          }}
          leadId={leadId}
          merchantId={merchantId}
          dealId={dealId}
          linkedEntityName={contactName}
        />
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>

            {/* CALL MODAL */}
            {modal === "call" && (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Log Call</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Direction</label>
                    <div className="flex gap-2">
                      {["outbound", "inbound"].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDirection(d)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 capitalize ${direction === d ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Contact Name</label>
                      <input type="text" value={modalName} onChange={(e) => setModalName(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Phone Number</label>
                      <input type="tel" value={modalPhone} onChange={(e) => setModalPhone(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Notes</label>
                    <textarea value={modalBody} onChange={(e) => setModalBody(e.target.value)} className={`${inputClass} h-24 resize-none`} rows={4} />
                  </div>
                </div>
              </>
            )}

            {/* EMAIL MODAL */}
            {modal === "email" && (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Log Email</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Direction</label>
                    <div className="flex gap-2">
                      {["sent", "received"].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDirection(d)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 capitalize ${direction === d ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>{direction === "sent" ? "To" : "From"}</label>
                    <input type="email" value={modalEmail} onChange={(e) => setModalEmail(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Template</label>
                    <select value={selectedTemplate} onChange={(e) => handleTemplateSelect(e.target.value)} className={inputClass}>
                      <option value="">No template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Subject</label>
                    <input type="text" value={modalSubject} onChange={(e) => setModalSubject(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Body</label>
                    <textarea value={modalBody} onChange={(e) => setModalBody(e.target.value)} className={`${inputClass} h-36 resize-none`} rows={6} />
                  </div>
                </div>
              </>
            )}

            {/* NOTE MODAL */}
            {modal === "note" && (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Note</h3>
                <div>
                  <textarea
                    value={modalBody}
                    onChange={(e) => setModalBody(e.target.value)}
                    className={`${inputClass} h-36 resize-none`}
                    rows={6}
                    placeholder="Enter your note..."
                  />
                </div>
              </>
            )}

            {/* Modal actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
