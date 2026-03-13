'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ExportCSV from '@/components/ExportCSV'
import TaskModal from '@/components/TaskModal'
import { useAuth } from '@/lib/auth-context'

const LEAD_EXPORT_COLUMNS = [
  { key: 'business_name', label: 'Business Name' },
  { key: 'contact_name', label: 'Contact Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'monthly_volume', label: 'Monthly Volume' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created' },
  { key: 'follow_up_date', label: 'Follow Up Date' },
]

type Lead = {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  status: string
  monthly_volume: number
  notes: string
  created_at: string
  updated_at: string
  follow_up_date?: string
}

const statusColors: Record<string, string> = {
  new_prospect: 'bg-blue-50 text-blue-700',
  contact_pending: 'bg-sky-50 text-sky-700',
  pending_qualification: 'bg-amber-50 text-amber-700',
  qualified_prospect: 'bg-emerald-50 text-emerald-700',
  submitted: 'bg-purple-50 text-purple-700',
  signed: 'bg-teal-50 text-teal-700',
  converted: 'bg-emerald-100 text-emerald-800',
  unqualified: 'bg-red-50 text-red-700',
  unresponsive: 'bg-slate-100 text-slate-600',
  recycled: 'bg-cyan-50 text-cyan-700',
}

const statusLabels: Record<string, string> = {
  new_prospect: 'New Prospect',
  contact_pending: 'Contact Pending',
  pending_qualification: 'Pending Qual',
  qualified_prospect: 'Qualified',
  submitted: 'Submitted',
  signed: 'Signed',
  converted: 'Converted',
  unqualified: 'Unqualified',
  unresponsive: 'Unresponsive',
  recycled: 'Recycled',
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LeadsPage() {
  const router = useRouter()
  const { user, member, loading: authLoading } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('newest')

  const role = member?.role || ''
  const isOwnerOrManager = role === 'owner' || role === 'manager'

  // Preview panel state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [previewActivities, setPreviewActivities] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  // Communication modal state
  const [commModal, setCommModal] = useState<'call' | 'note' | null>(null)
  const [commDirection, setCommDirection] = useState('outbound')
  const [commName, setCommName] = useState('')
  const [commPhone, setCommPhone] = useState('')
  const [commBody, setCommBody] = useState('')
  const [commSaving, setCommSaving] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetchLeads()
  }, [authLoading, user?.id])

  const fetchLeads = async () => {
    if (!user) return
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (!isOwnerOrManager) {
      query = query.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    }

    const { data } = await query
    setLeads(data || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('leads').update({ status }).eq('id', id)
    fetchLeads()
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    if (selectedLeadId === id) closePreview()
    fetchLeads()
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let result = leads.filter((lead) => {
      const matchSearch = !q ||
        (lead.business_name || '').toLowerCase().includes(q) ||
        (lead.contact_name || '').toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        ((lead as any).website || '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || lead.status === statusFilter
      return matchSearch && matchStatus
    })

    switch (sort) {
      case 'oldest':
        result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'name_az':
        result = [...result].sort((a, b) => (a.business_name || '').localeCompare(b.business_name || ''))
        break
      case 'name_za':
        result = [...result].sort((a, b) => (b.business_name || '').localeCompare(a.business_name || ''))
        break
      default:
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return result
  }, [leads, search, statusFilter, sort])

  // Preview panel logic
  const fetchPreviewActivities = useCallback(async (leadId: string) => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)
    setPreviewActivities(data || [])
  }, [])

  const openPreview = (lead: Lead) => {
    // On mobile, navigate directly
    if (window.innerWidth < 1024) {
      router.push(`/dashboard/leads/${lead.id}`)
      return
    }
    setSelectedLeadId(lead.id)
    setSelectedLead(lead)
    setPreviewLoading(true)
    fetchPreviewActivities(lead.id).then(() => setPreviewLoading(false))
  }

  const closePreview = () => {
    setSelectedLeadId(null)
    setSelectedLead(null)
    setPreviewActivities([])
  }

  // Communication modal logic
  const openCommModal = (type: 'call' | 'note') => {
    if (!selectedLead) return
    setCommModal(type)
    setCommDirection('outbound')
    setCommName(selectedLead.contact_name || '')
    setCommPhone(selectedLead.phone || '')
    setCommBody('')
  }

  const handleCommSave = async () => {
    if (!commModal || !selectedLead || !user) return
    setCommSaving(true)

    const record: Record<string, any> = {
      user_id: user.id,
      lead_id: selectedLead.id,
      merchant_id: null,
      deal_id: null,
      type: commModal,
      direction: commModal === 'note' ? null : commDirection,
      contact_name: commName || null,
      contact_phone: commModal === 'call' ? (commPhone || null) : null,
      body: commBody || null,
      logged_at: new Date().toISOString(),
    }

    await supabase.from('communications').insert(record)

    let desc = ''
    if (commModal === 'call') desc = `Call logged: ${commDirection} call with ${commName || 'unknown'}`
    else desc = `Note added${commName ? ` for ${commName}` : ''}`

    await supabase.from('activity_log').insert({
      user_id: user.id,
      lead_id: selectedLead.id,
      action_type: 'communication_logged',
      description: desc,
    })

    setCommModal(null)
    setCommSaving(false)
    fetchPreviewActivities(selectedLead.id)
  }

  const inputClass = "bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900"
  const modalInputClass = "w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">Leads</h2>
            <p className="text-slate-500 mt-1">{leads.length} total leads</p>
          </div>
          <a
            href="/dashboard/leads/new"
            className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition text-white"
          >
            + Add Lead
          </a>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full sm:flex-1 min-w-[200px] ${inputClass}`}
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
            <option value="name_za">Business Name Z-A</option>
          </select>
          <span className="text-base text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <ExportCSV data={filtered} filename="leads-export" columns={LEAD_EXPORT_COLUMNS} />
        </div>

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-4xl mb-4">🎯</p>
            <p className="text-lg">{leads.length === 0 ? 'No leads yet' : 'No matching leads'}</p>
            {leads.length === 0 && (
              <a href="/dashboard/leads/new" className="text-emerald-600 hover:underline text-sm mt-2 block">
                Add your first lead
              </a>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Business</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Contact</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Volume/mo</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Created</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Last Modified</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-base font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} onClick={() => openPreview(lead)} className="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer">
                    <td className="px-6 py-4">
                      <p className="font-medium text-base">{lead.business_name}</p>
                      <p className="text-slate-500 text-sm">{lead.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-base">{lead.contact_name}</p>
                      <p className="text-slate-500 text-sm">{lead.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-base">
                      {lead.monthly_volume ? `$${lead.monthly_volume.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={lead.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className={`text-xs px-3 py-1 rounded-full border-0 font-medium cursor-pointer ${statusColors[lead.status] || 'bg-slate-100 text-slate-600'}`}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "-"}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {/* PREVIEW PANEL BACKDROP */}
      {selectedLeadId && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={closePreview} />
      )}

      {/* PREVIEW PANEL */}
      <div className={`fixed right-0 top-0 h-full w-full lg:w-[480px] bg-white border-l border-slate-200 shadow-xl z-40 transform transition-transform duration-300 ${selectedLeadId ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {selectedLead && (
          <>
            {/* Close button */}
            <button onClick={closePreview} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl z-10">✕</button>

            {/* Header */}
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 pr-8">{selectedLead.business_name}</h3>
              {selectedLead.contact_name && (
                <p className="text-sm text-slate-500 mt-1">{selectedLead.contact_name}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[selectedLead.status] || 'bg-slate-100 text-slate-600'}`}>
                  {statusLabels[selectedLead.status] || selectedLead.status}
                </span>
                <span className="text-xs text-slate-400">
                  Created {new Date(selectedLead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-4 p-6 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Monthly Volume</p>
                <p className="text-sm font-medium text-slate-900">
                  {selectedLead.monthly_volume ? `$${selectedLead.monthly_volume.toLocaleString()}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Email</p>
                {selectedLead.email ? (
                  <a href={`mailto:${selectedLead.email}`} className="text-sm text-emerald-600 hover:text-emerald-700 truncate block">{selectedLead.email}</a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                {selectedLead.phone ? (
                  <a href={`tel:${selectedLead.phone}`} className="text-sm text-emerald-600 hover:text-emerald-700">{selectedLead.phone}</a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Follow-up</p>
                <p className="text-sm text-slate-900">
                  {selectedLead.follow_up_date
                    ? new Date(selectedLead.follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openCommModal('call')} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium transition">
                  📞 Log Call
                </button>
                {selectedLead.email ? (
                  <a href={`mailto:${selectedLead.email}`} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium transition inline-block">
                    ✉️ Email
                  </a>
                ) : (
                  <span className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium opacity-50 cursor-not-allowed">
                    ✉️ Email
                  </span>
                )}
                <button onClick={() => openCommModal('note')} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium transition">
                  📝 Note
                </button>
                <button onClick={() => setShowTaskModal(true)} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium transition">
                  📋 Follow-up
                </button>
              </div>
            </div>

            {/* Notes */}
            {selectedLead.notes && (
              <div className="p-6 border-b border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedLead.notes}</p>
              </div>
            )}

            {/* Recent Activity */}
            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-3 font-medium">Recent Activity</p>
              {previewLoading ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : previewActivities.length === 0 ? (
                <p className="text-xs text-slate-400">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {previewActivities.map((a) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 truncate">{a.description}</p>
                        <p className="text-xs text-slate-400">{relativeTime(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => router.push(`/dashboard/leads/${selectedLead.id}`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full py-2.5 rounded-lg text-sm font-medium transition"
              >
                Open Full Details →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && selectedLead && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSaved={async () => {
            if (user && selectedLead) {
              await supabase.from('activity_log').insert({
                user_id: user.id,
                lead_id: selectedLead.id,
                action_type: 'communication_logged',
                description: 'Follow-up task created',
              })
              fetchPreviewActivities(selectedLead.id)
            }
            setShowTaskModal(false)
          }}
          leadId={selectedLead.id}
          linkedEntityName={selectedLead.business_name}
        />
      )}

      {/* Communication Modal */}
      {commModal && selectedLead && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setCommModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            {commModal === 'call' && (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Log Call</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-600 font-medium block mb-1.5">Direction</label>
                    <div className="flex gap-2">
                      {['outbound', 'inbound'].map((d) => (
                        <button key={d} onClick={() => setCommDirection(d)} className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${commDirection === d ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-600 font-medium block mb-1.5">Contact Name</label>
                      <input type="text" value={commName} onChange={(e) => setCommName(e.target.value)} className={modalInputClass} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 font-medium block mb-1.5">Phone Number</label>
                      <input type="tel" value={commPhone} onChange={(e) => setCommPhone(e.target.value)} className={modalInputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 font-medium block mb-1.5">Notes</label>
                    <textarea value={commBody} onChange={(e) => setCommBody(e.target.value)} className={`${modalInputClass} h-24 resize-none`} rows={4} />
                  </div>
                </div>
              </>
            )}

            {commModal === 'note' && (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Note</h3>
                <div>
                  <textarea value={commBody} onChange={(e) => setCommBody(e.target.value)} className={`${modalInputClass} h-36 resize-none`} rows={6} placeholder="Enter your note..." />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setCommModal(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                Cancel
              </button>
              <button onClick={handleCommSave} disabled={commSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {commSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
