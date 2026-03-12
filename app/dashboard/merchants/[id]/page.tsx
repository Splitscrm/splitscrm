'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import CommunicationLog from '@/components/CommunicationLog'
import TaskModal from '@/components/TaskModal'
import { useAuth } from '@/lib/auth-context'

export default function MerchantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user: authUser, member, loading: authLoading } = useAuth()
  const role = member?.role || ''
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const canEdit = isOwnerOrManager || role === 'master_agent' || role === 'agent'
  const canSeePricing = isOwnerOrManager
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [merchant, setMerchant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [merchantTasks, setMerchantTasks] = useState<any[]>([])
  const [fadingTaskIds, setFadingTaskIds] = useState<Set<string>>(new Set())
  const [taskToast, setTaskToast] = useState(false)
  const [merchantUserId, setMerchantUserId] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    business: true,
    pricing: false,
    contract: false,
    financials: false,
    residuals: false,
  })
  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  const [showFullFees, setShowFullFees] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [newMidInput, setNewMidInput] = useState('')
  const [midDuplicate, setMidDuplicate] = useState(false)

  // Residual history state
  const [residualRecords, setResidualRecords] = useState<any[]>([])
  const [residualLoading, setResidualLoading] = useState(false)
  const [residualFetched, setResidualFetched] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})

  const syncFromDeal = async () => {
    if (!merchant?.lead_id) return
    setSyncing(true)
    const { data: dealData } = await supabase.from('deals').select('*').eq('lead_id', merchant.lead_id).single()
    if (!dealData) {
      setMsg('No linked deal found')
      setTimeout(() => setMsg(''), 2000)
      setSyncing(false)
      return
    }
    const dealToMerchant: Record<string, string> = {
      dba_name: 'dba_name',
      legal_street: 'business_street',
      legal_city: 'business_city',
      legal_state: 'business_state',
      legal_zip: 'business_zip',
      pricing_type: 'pricing_type',
      ic_plus_visa_pct: 'ic_plus_visa_pct',
      ic_plus_mc_pct: 'ic_plus_mc_pct',
      ic_plus_amex_pct: 'ic_plus_amex_pct',
      ic_plus_disc_pct: 'ic_plus_disc_pct',
      ic_plus_visa_txn: 'ic_plus_visa_txn',
      ic_plus_mc_txn: 'ic_plus_mc_txn',
      ic_plus_amex_txn: 'ic_plus_amex_txn',
      ic_plus_disc_txn: 'ic_plus_disc_txn',
      dual_pricing_rate: 'dual_pricing_rate',
      dual_pricing_txn_fee: 'dual_pricing_txn_fee',
      flat_rate_pct: 'flat_rate_pct',
      flat_rate_txn_cost: 'flat_rate_txn_cost',
      fee_chargeback: 'fee_chargeback',
      fee_retrieval: 'fee_retrieval',
      fee_arbitration: 'fee_arbitration',
      fee_voice_auth: 'fee_voice_auth',
      fee_ebt_auth: 'fee_ebt_auth',
      fee_gateway_monthly: 'fee_gateway_monthly',
      fee_gateway_txn: 'fee_gateway_txn',
      fee_ach_reject: 'fee_ach_reject',
      monthly_fee_statement: 'monthly_fee_statement',
      monthly_fee_custom_name: 'monthly_fee_custom_name',
      monthly_fee_custom_amount: 'monthly_fee_custom_amount',
      pci_compliance_monthly: 'pci_compliance_monthly',
      pci_compliance_annual: 'pci_compliance_annual',
      interchange_remittance: 'interchange_remittance',
      terminal_type: 'terminal_type',
      terminal_cost: 'equipment_cost',
      monthly_volume: 'monthly_volume',
    }
    const updated = { ...merchant }
    let syncedCount = 0
    for (const [dealField, merchantField] of Object.entries(dealToMerchant)) {
      const dealVal = dealData[dealField]
      const merchantVal = updated[merchantField]
      if (dealVal != null && dealVal !== '' && (merchantVal == null || merchantVal === '')) {
        updated[merchantField] = dealVal
        syncedCount++
      }
    }
    // free_hardware → free_equipment
    if (dealData.free_hardware && !updated.free_equipment) {
      if (dealData.free_hardware === 'yes' || dealData.free_hardware === 'no') {
        updated.free_equipment = dealData.free_hardware
        syncedCount++
      }
    }
    setMerchant(updated)
    setMsg(`Synced ${syncedCount} field${syncedCount !== 1 ? 's' : ''} from deal`)
    setTimeout(() => setMsg(''), 3000)
    setSyncing(false)
  }

  const fetchResidualHistory = async (merchantId: string) => {
    if (residualFetched) return
    setResidualLoading(true)
    const { data } = await supabase
      .from('residual_records')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('report_month', { ascending: false })
    setResidualRecords(data || [])
    setResidualFetched(true)
    setResidualLoading(false)
  }

  const handleToggleResiduals = (merchantId: string) => {
    const willOpen = !openGroups.residuals
    toggleGroup('residuals')
    if (willOpen) fetchResidualHistory(merchantId)
  }

  useEffect(() => {
    if (authLoading) return
    const fetchMerchant = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMerchantUserId(user.id)

      const { data } = await supabase.from('merchants').select('*').eq('id', params.id).single()
      if (data) {
        // Permission check: non-owner/manager can only see their own merchants
        if (!isOwnerOrManager && data.assigned_to !== user.id && data.user_id !== user.id) {
          setPermissionDenied(true)
          setLoading(false)
          return
        }
        setMerchant(data)
        const { data: taskData } = await supabase.from('tasks').select('id, title, due_date, priority, status').eq('merchant_id', params.id).eq('status', 'pending').order('due_date', { ascending: true })
        if (taskData) setMerchantTasks(taskData)
      }
      setLoading(false)
    }
    fetchMerchant()
  }, [params.id, authLoading])

  const fetchTasks = useCallback(async () => {
    const { data: taskData } = await supabase.from('tasks').select('id, title, due_date, priority, status').eq('merchant_id', params.id).eq('status', 'pending').order('due_date', { ascending: true })
    if (taskData) setMerchantTasks(taskData)
    setTaskToast(true)
    setTimeout(() => setTaskToast(false), 2000)
  }, [params.id])

  const updateField = (field: string, value: any) => {
    setMerchant({ ...merchant, [field]: value })
  }

  const handleSave = async () => {
    if (!merchant.business_name?.trim()) {
      setError('Business name is required')
      return
    }
    setSaving(true)
    setError('')

    const { id, created_at, user_id, lead_id, ...updates } = merchant
    console.log('Merchant update payload:', updates)
    console.log('mid value:', updates.mid)
    const { error: updateError } = await supabase.from('merchants').update(updates).eq('id', merchant.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setMsg('Merchant saved!')
      setTimeout(() => setMsg(''), 2000)
    }
    setSaving(false)
  }

  const inputClass = 'w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  const labelClass = 'text-sm text-slate-600 block mb-1'
  const sectionClass = 'bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-4'

  const chargebackRatio = parseFloat(merchant?.chargeback_ratio) || 0
  const chargebackCount = parseInt(merchant?.chargeback_count) || 0

  if (authLoading || loading) return <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8">Loading...</div>

  if (permissionDenied) return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />
      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-500 mb-6">You don't have permission to view this merchant.</p>
          <Link href="/dashboard/merchants" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Back to Merchants</Link>
        </div>
      </div>
    </div>
  )
  if (!merchant) return <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8">Merchant not found</div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <Link href="/dashboard/merchants" className="text-slate-400 hover:text-slate-900 text-sm transition">← Back to Merchants</Link>

        {merchant.lead_id && (
          <div className="mt-2">
            <Link href={`/dashboard/leads/${merchant.lead_id}`} className="text-emerald-600 hover:text-emerald-700 text-sm transition">
              View Original Lead →
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mt-4 mb-6">
          <h2 className="text-xl lg:text-2xl font-bold">{merchant.business_name}</h2>
          <div className="flex flex-wrap items-center gap-3">
            {msg && <span className="text-emerald-600 text-sm">{msg}</span>}
            {merchant.lead_id && (
              <button onClick={syncFromDeal} disabled={syncing} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                {syncing ? 'Syncing...' : 'Sync from Deal'}
              </button>
            )}
            {canEdit && (
              <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Merchant'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
        )}

        {/* Communication Log */}
        <div className="max-w-4xl mb-6">
          <CommunicationLog
            merchantId={merchant.id}
            linkedLeadId={merchant.lead_id}
            contactName={merchant.contact_name}
            contactPhone={merchant.phone}
            contactEmail={merchant.email}
            onTaskCreated={fetchTasks}
          />
        </div>

        {/* Task Toast */}
        {taskToast && (
          <p className="max-w-4xl text-emerald-600 text-sm font-medium mb-2">✅ Follow-up created</p>
        )}

        {/* Upcoming Tasks */}
        {merchantTasks.length > 0 && (() => {
          const today = new Date().toISOString().split('T')[0]
          const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
          const priorityDot: Record<string, string> = { low: 'bg-slate-300', medium: 'bg-blue-400', high: 'bg-amber-400', urgent: 'bg-red-500' }
          const dueLabel = (d: string | null) => {
            if (!d) return null
            if (d < today) return <span className="text-xs text-red-500 font-medium ml-auto">Overdue</span>
            if (d === today) return <span className="text-xs text-emerald-600 ml-auto">Today</span>
            if (d === tomorrow) return <span className="text-xs text-blue-600 ml-auto">Tomorrow</span>
            return <span className="text-xs text-slate-400 ml-auto">{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          }
          return (
            <div className="max-w-4xl bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-slate-900">Upcoming Tasks</span>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full ml-2">{merchantTasks.length}</span>
                </div>
                <button onClick={() => setShowTaskModal(true)} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">+ Add</button>
              </div>
              <div>
                {merchantTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 py-2 ${i < merchantTasks.length - 1 ? 'border-b border-slate-50' : ''} transition-opacity duration-300 ${fadingTaskIds.has(task.id) ? 'opacity-0' : 'opacity-100'}`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-emerald-600"
                      onChange={async () => {
                        setFadingTaskIds(prev => new Set(prev).add(task.id))
                        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
                        if (merchantUserId) {
                          supabase.from('activity_log').insert({ user_id: merchantUserId, merchant_id: merchant.id, action_type: 'task_completed', description: `Task completed: ${task.title}` })
                        }
                        setTimeout(() => setMerchantTasks(prev => prev.filter(t => t.id !== task.id)), 300)
                      }}
                    />
                    <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[task.priority] || 'bg-slate-300'}`} />
                    <span className="text-xs font-medium text-slate-700 flex-1 truncate">{task.title}</span>
                    {dueLabel(task.due_date)}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            onClose={() => setShowTaskModal(false)}
            onSaved={fetchTasks}
            merchantId={merchant.id}
            linkedEntityName={merchant.dba_name || merchant.legal_name}
          />
        )}

        <div className="max-w-4xl space-y-2">
          {/* GROUP 1 — Business Information */}
          <div onClick={() => toggleGroup('business')} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.business ? 'border-l-4 border-l-emerald-500' : ''}`}>
            <h3 className="font-semibold">Business Information</h3>
            <span className={`text-slate-400 transition-transform duration-200 ${openGroups.business ? 'rotate-180' : ''}`}>▼</span>
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.business ? '5000px' : '0px', opacity: openGroups.business ? 1 : 0 }}>
            <div className={sectionClass}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Business Name *</label>
                    <input type="text" value={merchant.business_name || ''} onChange={(e) => updateField('business_name', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>DBA Name</label>
                    <input type="text" value={merchant.dba_name || ''} onChange={(e) => updateField('dba_name', e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className={labelClass}>Street</label>
                    <input type="text" value={merchant.business_street || ''} onChange={(e) => updateField('business_street', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input type="text" value={merchant.business_city || ''} onChange={(e) => updateField('business_city', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input type="text" value={merchant.business_state || ''} onChange={(e) => updateField('business_state', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Zip</label>
                    <input type="text" value={merchant.business_zip || ''} onChange={(e) => updateField('business_zip', e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Contact Name</label>
                    <input type="text" value={merchant.contact_name || ''} onChange={(e) => updateField('contact_name', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={merchant.email || ''} onChange={(e) => updateField('email', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input type="tel" value={merchant.phone || ''} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className={labelClass}>Merchant IDs (MIDs)</label>
                    {(() => {
                      const mids = (merchant.mid || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                      const removeMid = (midToRemove: string) => {
                        const updated = mids.filter((m: string) => m !== midToRemove).join(', ')
                        updateField('mid', updated || null)
                      }
                      const addMid = () => {
                        const val = newMidInput.trim()
                        if (!val) return
                        if (mids.includes(val)) {
                          setMidDuplicate(true)
                          setTimeout(() => setMidDuplicate(false), 1500)
                          return
                        }
                        const updated = mids.length > 0 ? [...mids, val].join(', ') : val
                        updateField('mid', updated)
                        setNewMidInput('')
                      }
                      return (
                        <div>
                          <div className="flex flex-wrap gap-2 items-center">
                            {mids.map((mid: string) => (
                              <span key={mid} className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                                {mid}
                                <span onClick={() => removeMid(mid)} className="text-slate-400 hover:text-red-500 cursor-pointer text-xs font-bold">×</span>
                              </span>
                            ))}
                            <input
                              type="text"
                              value={newMidInput}
                              onChange={(e) => setNewMidInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMid() } }}
                              onBlur={addMid}
                              placeholder="Add MID..."
                              className="bg-white border border-slate-200 rounded-full px-3 py-1.5 text-sm w-40 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                          {mids.length === 0 && !newMidInput && <p className="text-xs text-slate-400 mt-1">No MIDs assigned</p>}
                          {midDuplicate && <p className="text-xs text-amber-600 mt-1">Duplicate — this MID already exists</p>}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Processor</label>
                  <input type="text" value={merchant.processor || ''} onChange={(e) => updateField('processor', e.target.value)} className={inputClass} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={merchant.status || 'active'} onChange={(e) => updateField('status', e.target.value)} className={inputClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={merchant.notes || ''} onChange={(e) => updateField('notes', e.target.value)} className={inputClass + ' h-32 resize-none'} />
                </div>
              </div>
            </div>
          </div>

          {/* GROUP 2 — Pricing & Fees */}
          {canSeePricing ? (
          <div onClick={() => toggleGroup('pricing')} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.pricing ? 'border-l-4 border-l-emerald-500' : ''}`}>
            <h3 className="font-semibold">Pricing & Fees</h3>
            <span className={`text-slate-400 transition-transform duration-200 ${openGroups.pricing ? 'rotate-180' : ''}`}>▼</span>
          </div>
          ) : (
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">🔒</span>
              <h3 className="font-semibold text-slate-400">Pricing & Fees</h3>
              <span className="text-xs text-slate-400 ml-auto">Restricted</span>
            </div>
          </div>
          )}
          {canSeePricing && (
          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.pricing ? '10000px' : '0px', opacity: openGroups.pricing ? 1 : 0 }}>
            {/* Level 1 — Summary */}
            <div className={sectionClass}>
              <div className="space-y-6">
                <div>
                  <label className={labelClass}>Pricing Type</label>
                  <select value={merchant.pricing_type || ''} onChange={(e) => updateField('pricing_type', e.target.value)} className={inputClass}>
                    <option value="">Select...</option>
                    <option value="interchange_plus">Interchange Plus</option>
                    <option value="dual_pricing">Dual Pricing</option>
                    <option value="surcharging">Surcharging</option>
                    <option value="tiered">Tiered</option>
                    <option value="flat_rate">Flat Rate</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Pricing Rate (%)</label>
                    <input type="number" step="0.01" value={merchant.pricing_rate ?? ''} onChange={(e) => updateField('pricing_rate', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Per Transaction Fee ($)</label>
                    <input type="number" step="0.01" value={merchant.per_transaction_fee ?? ''} onChange={(e) => updateField('per_transaction_fee', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Monthly Fees ($)</label>
                    <input type="number" step="0.01" value={merchant.monthly_fees ?? ''} onChange={(e) => updateField('monthly_fees', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                </div>

                <div
                  onClick={() => setShowFullFees(!showFullFees)}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium cursor-pointer flex items-center gap-1"
                >
                  View All Fees & Details
                  <span className={`transition-transform duration-200 ${showFullFees ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>
            </div>

            {/* Level 2 — Full Detail */}
            <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: showFullFees ? '5000px' : '0px', opacity: showFullFees ? 1 : 0 }}>
              {/* Rate Details */}
              <div className={sectionClass}>
                <h4 className="text-sm font-semibold text-slate-700 mb-4">Rate Details</h4>
                {merchant.pricing_type === 'interchange_plus' && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Percentage Markups</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                          <label className={labelClass}>Visa (%)</label>
                          <input type="number" step="0.01" value={merchant.ic_plus_visa_pct ?? ''} onChange={(e) => updateField('ic_plus_visa_pct', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>MC (%)</label>
                          <input type="number" step="0.01" value={merchant.ic_plus_mc_pct ?? ''} onChange={(e) => updateField('ic_plus_mc_pct', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>AMEX (%)</label>
                          <input type="number" step="0.01" value={merchant.ic_plus_amex_pct ?? ''} onChange={(e) => updateField('ic_plus_amex_pct', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Disc (%)</label>
                          <input type="number" step="0.01" value={merchant.ic_plus_disc_pct ?? ''} onChange={(e) => updateField('ic_plus_disc_pct', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Per Transaction</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                          <label className={labelClass}>Visa ($)</label>
                          <input type="number" step="0.001" value={merchant.ic_plus_visa_txn ?? ''} onChange={(e) => updateField('ic_plus_visa_txn', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>MC ($)</label>
                          <input type="number" step="0.001" value={merchant.ic_plus_mc_txn ?? ''} onChange={(e) => updateField('ic_plus_mc_txn', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>AMEX ($)</label>
                          <input type="number" step="0.001" value={merchant.ic_plus_amex_txn ?? ''} onChange={(e) => updateField('ic_plus_amex_txn', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Disc ($)</label>
                          <input type="number" step="0.001" value={merchant.ic_plus_disc_txn ?? ''} onChange={(e) => updateField('ic_plus_disc_txn', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Interchange Remittance</label>
                      <select value={merchant.interchange_remittance || ''} onChange={(e) => updateField('interchange_remittance', e.target.value || null)} className={inputClass}>
                        <option value="">Select...</option>
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                )}
                {merchant.pricing_type === 'dual_pricing' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>Dual Pricing Rate (%)</label>
                      <input type="number" step="0.01" value={merchant.dual_pricing_rate ?? ''} onChange={(e) => updateField('dual_pricing_rate', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Per Transaction Fee ($)</label>
                      <input type="number" step="0.01" value={merchant.dual_pricing_txn_fee ?? ''} onChange={(e) => updateField('dual_pricing_txn_fee', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                  </div>
                )}
                {merchant.pricing_type === 'flat_rate' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>Flat Rate (%)</label>
                      <input type="number" step="0.01" value={merchant.flat_rate_pct ?? ''} onChange={(e) => updateField('flat_rate_pct', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Per Transaction ($)</label>
                      <input type="number" step="0.01" value={merchant.flat_rate_txn_cost ?? ''} onChange={(e) => updateField('flat_rate_txn_cost', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                  </div>
                )}
                {(merchant.pricing_type === 'tiered' || merchant.pricing_type === 'surcharging') && (
                  <p className="text-slate-400 text-sm">Configuration coming soon</p>
                )}
                {!merchant.pricing_type && (
                  <p className="text-slate-400 text-sm">Select a pricing type above to configure rate details</p>
                )}
              </div>

              {/* Misc Fees */}
              <div className={sectionClass}>
                <h4 className="text-sm font-semibold text-slate-700 mb-4">Misc Fees ($)</h4>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className={labelClass}>Chargebacks</label>
                      <input type="number" step="0.01" value={merchant.fee_chargeback ?? ''} onChange={(e) => updateField('fee_chargeback', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Retrievals</label>
                      <input type="number" step="0.01" value={merchant.fee_retrieval ?? ''} onChange={(e) => updateField('fee_retrieval', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Arbitration</label>
                      <input type="number" step="0.01" value={merchant.fee_arbitration ?? ''} onChange={(e) => updateField('fee_arbitration', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Voice Auths</label>
                      <input type="number" step="0.01" value={merchant.fee_voice_auth ?? ''} onChange={(e) => updateField('fee_voice_auth', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className={labelClass}>EBT Auths</label>
                      <input type="number" step="0.01" value={merchant.fee_ebt_auth ?? ''} onChange={(e) => updateField('fee_ebt_auth', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Gateway Monthly</label>
                      <input type="number" step="0.01" value={merchant.fee_gateway_monthly ?? ''} onChange={(e) => updateField('fee_gateway_monthly', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Gateway Per Txn</label>
                      <input type="number" step="0.01" value={merchant.fee_gateway_txn ?? ''} onChange={(e) => updateField('fee_gateway_txn', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>ACH Reject</label>
                      <input type="number" step="0.01" value={merchant.fee_ach_reject ?? ''} onChange={(e) => updateField('fee_ach_reject', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Fees */}
              <div className={sectionClass}>
                <h4 className="text-sm font-semibold text-slate-700 mb-4">Monthly Fees</h4>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className={labelClass}>Statement Fee ($)</label>
                      <input type="number" step="0.01" value={merchant.monthly_fee_statement ?? ''} onChange={(e) => updateField('monthly_fee_statement', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Custom Fee Name</label>
                      <input type="text" value={merchant.monthly_fee_custom_name || ''} onChange={(e) => updateField('monthly_fee_custom_name', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Custom Fee Amount ($)</label>
                      <input type="number" step="0.01" value={merchant.monthly_fee_custom_amount ?? ''} onChange={(e) => updateField('monthly_fee_custom_amount', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>PCI Compliance Monthly ($)</label>
                      <input type="number" step="0.01" value={merchant.pci_compliance_monthly ?? ''} onChange={(e) => updateField('pci_compliance_monthly', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>PCI Compliance Annual ($)</label>
                      <input type="number" step="0.01" value={merchant.pci_compliance_annual ?? ''} onChange={(e) => updateField('pci_compliance_annual', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* GROUP 3 — Contract & Equipment */}
          <div onClick={() => toggleGroup('contract')} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.contract ? 'border-l-4 border-l-emerald-500' : ''}`}>
            <h3 className="font-semibold">Contract & Equipment</h3>
            <span className={`text-slate-400 transition-transform duration-200 ${openGroups.contract ? 'rotate-180' : ''}`}>▼</span>
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.contract ? '5000px' : '0px', opacity: openGroups.contract ? 1 : 0 }}>
            <div className={sectionClass}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Boarding Date</label>
                    <input type="date" value={merchant.boarding_date || ''} onChange={(e) => updateField('boarding_date', e.target.value || null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Contract Length (months)</label>
                    <input type="number" value={merchant.contract_length_months ?? ''} onChange={(e) => updateField('contract_length_months', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Contract End Date</label>
                    <input type="date" value={merchant.contract_end_date || ''} onChange={(e) => updateField('contract_end_date', e.target.value || null)} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Terminal Type</label>
                    <input type="text" value={merchant.terminal_type || ''} onChange={(e) => updateField('terminal_type', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Terminal Serial #</label>
                    <input type="text" value={merchant.terminal_serial || ''} onChange={(e) => updateField('terminal_serial', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Equipment Cost ($)</label>
                    <input type="number" step="0.01" value={merchant.equipment_cost ?? ''} onChange={(e) => updateField('equipment_cost', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Free Equipment</label>
                  <select value={merchant.free_equipment || ''} onChange={(e) => updateField('free_equipment', e.target.value || null)} className={inputClass}>
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* GROUP 4 — Financials & Risk */}
          <div onClick={() => toggleGroup('financials')} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.financials ? 'border-l-4 border-l-emerald-500' : ''}`}>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Financials & Risk</h3>
              {chargebackCount > 0 && (
                <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full">{chargebackCount} chargeback{chargebackCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <span className={`text-slate-400 transition-transform duration-200 ${openGroups.financials ? 'rotate-180' : ''}`}>▼</span>
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.financials ? '5000px' : '0px', opacity: openGroups.financials ? 1 : 0 }}>
            <div className={sectionClass}>
              <div className="space-y-6">
                {chargebackRatio > 1.0 && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                    🚨 Chargeback ratio EXCEEDS Visa/MC threshold — immediate action required
                  </div>
                )}
                {chargebackRatio > 0.9 && chargebackRatio <= 1.0 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-600 px-4 py-3 rounded-lg text-sm">
                    ⚠️ Chargeback ratio approaching Visa/MC threshold (1.0%)
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Monthly Volume ($)</label>
                    <input type="number" step="0.01" value={merchant.monthly_volume ?? ''} onChange={(e) => updateField('monthly_volume', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Last Month Residual ($)</label>
                    <input type="number" step="0.01" value={merchant.last_month_residual ?? ''} onChange={(e) => updateField('last_month_residual', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Average Residual ($)</label>
                    <input type="number" step="0.01" value={merchant.average_residual ?? ''} onChange={(e) => updateField('average_residual', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Chargeback Count</label>
                    <input type="number" value={merchant.chargeback_count ?? ''} onChange={(e) => updateField('chargeback_count', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Chargeback Volume ($)</label>
                    <input type="number" step="0.01" value={merchant.chargeback_volume ?? ''} onChange={(e) => updateField('chargeback_volume', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Chargeback Ratio (%)</label>
                    <input type="number" step="0.01" value={merchant.chargeback_ratio ?? ''} onChange={(e) => updateField('chargeback_ratio', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GROUP 5 — Residual History */}
          <div onClick={() => handleToggleResiduals(merchant.id)} className={`flex justify-between items-center cursor-pointer bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-2 ${openGroups.residuals ? 'border-l-4 border-l-emerald-500' : ''}`}>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Residual History</h3>
              {residualFetched && (() => {
                const months = new Set(residualRecords.map(r => r.report_month).filter(Boolean))
                return months.size > 0 ? (
                  <span className="bg-emerald-50 text-emerald-600 text-xs px-2 py-0.5 rounded-full">{months.size} month{months.size !== 1 ? 's' : ''}</span>
                ) : null
              })()}
            </div>
            <span className={`text-slate-400 transition-transform duration-200 ${openGroups.residuals ? 'rotate-180' : ''}`}>▼</span>
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openGroups.residuals ? '10000px' : '0px', opacity: openGroups.residuals ? 1 : 0 }}>
            {residualLoading ? (
              <div className={sectionClass}>
                <div className="text-center py-8">
                  <div className="inline-block animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full mb-3" />
                  <p className="text-slate-400 text-sm">Loading residual history...</p>
                </div>
              </div>
            ) : residualRecords.length === 0 ? (
              <div className={sectionClass}>
                <p className="text-slate-400 text-sm mb-3">No residual data yet. Import a residual report to see this merchant's monthly performance.</p>
                <a href="/dashboard/residuals" className="text-emerald-600 text-sm hover:underline">Import Residuals →</a>
              </div>
            ) : (() => {
              const byMonth: Record<string, any[]> = {}
              for (const r of residualRecords) {
                const key = r.report_month || 'Unknown'
                if (!byMonth[key]) byMonth[key] = []
                byMonth[key].push(r)
              }
              const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))

              const monthlyNets = monthKeys.map(k => {
                const recs = byMonth[k]
                const rev = recs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0)
                const exp = recs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0)
                return rev - exp
              })
              const avgNet = monthlyNets.length > 0 ? monthlyNets.reduce((a, b) => a + b, 0) / monthlyNets.length : 0
              let trendPct: number | null = null
              if (monthlyNets.length >= 2 && monthlyNets[1] !== 0) {
                trendPct = ((monthlyNets[0] - monthlyNets[1]) / Math.abs(monthlyNets[1])) * 100
              }

              const fmtDollar = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
              const fmtMonth = (key: string) => {
                if (key === 'Unknown') return key
                const [y, m] = key.split('-')
                const d = new Date(parseInt(y), parseInt(m) - 1)
                return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              }

              return (
                <div>
                  {/* Summary */}
                  <div className={sectionClass}>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-slate-500">Total months tracked: <strong className="text-slate-900">{monthKeys.length}</strong></span>
                      <span className="text-slate-500">Average monthly net: <strong className={avgNet >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtDollar(avgNet)}</strong></span>
                      {trendPct !== null && (
                        <span className="text-slate-500">Trend: <strong className={trendPct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct).toFixed(1)}%</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Monthly cards */}
                  {monthKeys.map(monthKey => {
                    const recs = byMonth[monthKey]
                    const volume = recs.reduce((s: number, r: any) => s + (r.sales_amount || 0), 0)
                    const revenue = recs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0)
                    const expenses = recs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0)
                    const transactions = recs.reduce((s: number, r: any) => s + (r.sales_count || 0), 0)
                    const net = revenue - expenses
                    const isExpanded = expandedMonths[monthKey] || false

                    return (
                      <div key={monthKey} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-semibold text-slate-900">{fmtMonth(monthKey)}</span>
                          <span className={`font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtDollar(net)}</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-slate-500">Volume</p>
                            <p className="text-sm font-medium text-slate-900">{fmtDollar(volume)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Revenue</p>
                            <p className="text-sm font-medium text-slate-900">{fmtDollar(revenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Expenses</p>
                            <p className="text-sm font-medium text-red-600">{fmtDollar(expenses)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Transactions</p>
                            <p className="text-sm font-medium text-slate-900">{transactions.toLocaleString()}</p>
                          </div>
                        </div>
                        <span
                          onClick={(e) => { e.stopPropagation(); setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] })) }}
                          className="text-emerald-600 text-sm cursor-pointer hover:underline inline-block mt-3"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </span>
                        {isExpanded && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase font-medium">Fee Category</th>
                                  <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase font-medium">Description</th>
                                  <th className="text-right px-3 py-2 text-xs text-slate-500 uppercase font-medium">Sales</th>
                                  <th className="text-right px-3 py-2 text-xs text-slate-500 uppercase font-medium">Credits</th>
                                  <th className="text-right px-3 py-2 text-xs text-slate-500 uppercase font-medium">Interchange</th>
                                  <th className="text-right px-3 py-2 text-xs text-slate-500 uppercase font-medium">Expenses</th>
                                  <th className="text-right px-3 py-2 text-xs text-slate-500 uppercase font-medium">Income</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recs.map((rec: any) => {
                                  const fmtCell = (val: number | null) => {
                                    if (val == null) return <span className="text-slate-300">—</span>
                                    return <span className={val < 0 ? 'text-red-600' : ''} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDollar(val)}</span>
                                  }
                                  return (
                                    <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                                      <td className="px-3 py-2 text-slate-500">{rec.fee_category || '—'}</td>
                                      <td className="px-3 py-2 text-slate-500">{rec.description || '—'}</td>
                                      <td className="px-3 py-2 text-right">{fmtCell(rec.sales_amount)}</td>
                                      <td className="px-3 py-2 text-right">{fmtCell(rec.credit_amount)}</td>
                                      <td className="px-3 py-2 text-right">{fmtCell(rec.interchange_cost)}</td>
                                      <td className="px-3 py-2 text-right">{fmtCell(rec.total_expenses)}</td>
                                      <td className="px-3 py-2 text-right">{fmtCell(rec.gross_income)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
