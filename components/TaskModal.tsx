"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TaskModalProps {
  onClose: () => void;
  onSaved: () => void;
  leadId?: string;
  merchantId?: string;
  dealId?: string;
  linkedEntityName?: string;
  editTask?: {
    id: string;
    title: string;
    description: string;
    due_date: string;
    due_time: string;
    priority: string;
  } | null;
}

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-600" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-amber-100 text-amber-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
];

export default function TaskModal({
  onClose,
  onSaved,
  leadId,
  merchantId,
  dealId,
  linkedEntityName,
  editTask,
}: TaskModalProps) {
  const [title, setTitle] = useState(editTask?.title || "");
  const [description, setDescription] = useState(editTask?.description || "");
  const [dueDate, setDueDate] = useState(editTask?.due_date || "");
  const [dueTime, setDueTime] = useState(editTask?.due_time || "");
  const [priority, setPriority] = useState(editTask?.priority || "medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm";

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const record: Record<string, any> = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      priority,
      status: "pending",
      lead_id: leadId || null,
      merchant_id: merchantId || null,
      deal_id: dealId || null,
    };

    if (editTask) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update(record)
        .eq("id", editTask.id);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("tasks")
        .insert(record);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      // Log activity
      await supabase.from("activity_log").insert({
        user_id: user.id,
        lead_id: leadId || null,
        merchant_id: merchantId || null,
        deal_id: dealId || null,
        action_type: "task_created",
        description: `Task created: ${title.trim()}`,
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {editTask ? "Edit Task" : "New Task"}
        </h3>

        {linkedEntityName && (
          <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4 text-sm text-slate-600">
            Linked to: <span className="font-medium text-slate-900">{linkedEntityName}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 font-medium block mb-1.5">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Follow up on pricing proposal..."
            />
          </div>

          <div>
            <label className="text-sm text-slate-600 font-medium block mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} h-20 resize-none`}
              placeholder="Additional details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600 font-medium block mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 font-medium block mb-1.5">
                Due Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600 font-medium block mb-1.5">
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    priority === p.value
                      ? p.color + " ring-2 ring-offset-1 ring-slate-300"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? "Saving..." : editTask ? "Update Task" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
