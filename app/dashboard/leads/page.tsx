'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ExportCSV from '@/components/ExportCSV'
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

  const inputClass = "bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900"

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
          <span className="text-sm text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
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
                  <th className="text-left px-6 py-4 text-slate-500 text-sm font-medium">Business</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-sm font-medium">Contact</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-sm font-medium">Volume/mo</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-sm font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-sm font-medium">Last Modified</th>
                  <th className="text-left px-6 py-4 text-slate-500 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} onClick={() => router.push(`/dashboard/leads/${lead.id}`)} className="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer">
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
    </div>
  )
}
