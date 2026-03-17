'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import TaskModal from '@/components/TaskModal'
import { useAuth } from '@/lib/auth-context'
import LoadingScreen from '@/components/LoadingScreen'

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
  const [showFullResiduals, setShowFullResiduals] = useState(false)

  // Communications state for right column
  const [recentComms, setRecentComms] = useState<any[]>([])
  const [commsLoading, setCommsLoading] = useState(false)
  const [expandedComms, setExpandedComms] = useState<Record<string, boolean>>({})
  const [showAllComms, setShowAllComms] = useState(false)

  // Communication modal state
  const [commModal, setCommModal] = useState<'call' | 'email' | 'note' | null>(null)
  const [commDirection, setCommDirection] = useState('outbound')
  const [commName, setCommName] = useState('')
  const [commPhone, setCommPhone] = useState('')
  const [commEmail, setCommEmail] = useState('')
  const [commSubject, setCommSubject] = useState('')
  const [commBody, setCommBody] = useState('')
  const [commSaving, setCommSaving] = useState(false)
  const [phoneCopied, setPhoneCopied] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [showCommTaskModal, setShowCommTaskModal] = useState(false)

  const syncFromDeal = async () => {
    if (!merchant?.lead_id) return
    setSyncing(true)
    const { data: dealData } = await supabase.from('deals').select('dba_name, legal_street, legal_city, legal_state, legal_zip, pricing_type, ic_plus_visa_pct, ic_plus_mc_pct, ic_plus_amex_pct, ic_plus_disc_pct, ic_plus_visa_txn, ic_plus_mc_txn, ic_plus_amex_txn, ic_plus_disc_txn, dual_pricing_rate, dual_pricing_txn_fee, flat_rate_pct, flat_rate_txn_cost, fee_chargeback, fee_retrieval, fee_arbitration, fee_voice_auth, fee_ebt_auth, fee_gateway_monthly, fee_gateway_txn, fee_ach_reject, monthly_fee_statement, monthly_fee_custom_name, monthly_fee_custom_amount, pci_compliance_monthly, pci_compliance_annual, interchange_remittance, terminal_type, terminal_cost, monthly_volume, free_hardware').eq('lead_id', merchant.lead_id).single()
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
      const dealVal = (dealData as Record<string, any>)[dealField]
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
      .select('id, report_month, gross_income, total_expenses, sales_amount, sales_count, fee_category, description')
      .eq('merchant_id', merchantId)
      .order('report_month', { ascending: false })
    setResidualRecords(data || [])
    setResidualFetched(true)
    setResidualLoading(false)
  }

  const fetchRecentComms = async (merchantId: string, leadId?: string, fetchAll?: boolean) => {
    setCommsLoading(true)
    let query = supabase
      .from('communications')
      .select('id, type, subject, body, logged_at')
      .order('logged_at', { ascending: false })

    if (!fetchAll) query = query.limit(5)

    if (leadId) {
      query = query.or(`merchant_id.eq.${merchantId},lead_id.eq.${leadId}`)
    } else {
      query = query.eq('merchant_id', merchantId)
    }

    const { data } = await query
    setRecentComms(data || [])
    setCommsLoading(false)
  }

  const openCommModal = (type: 'call' | 'email' | 'note') => {
    setCommModal(type)
    setCommDirection(type === 'email' ? 'sent' : 'outbound')
    setCommName(merchant?.contact_name || '')
    setCommPhone(merchant?.phone || '')
    setCommEmail(merchant?.email || '')
    setCommSubject('')
    setCommBody('')
    setSelectedTemplate('')
  }

  const handleCommSave = async () => {
    if (!commModal) return
    setCommSaving(true)

    const record: Record<string, any> = {
      user_id: merchantUserId,
      lead_id: null,
      merchant_id: merchant?.id || null,
      deal_id: null,
      type: commModal,
      direction: commModal === 'note' ? null : commDirection,
      contact_name: commName || null,
      contact_email: commModal === 'email' ? (commEmail || null) : null,
      contact_phone: commModal === 'call' ? (commPhone || null) : null,
      subject: commModal === 'email' ? (commSubject || null) : null,
      body: commBody || null,
      duration_seconds: null,
      logged_at: new Date().toISOString(),
    }

    await supabase.from('communications').insert(record)

    // Activity log
    let desc = ''
    if (commModal === 'call') desc = `Call logged: ${commDirection} call with ${commName || 'unknown'}`
    else if (commModal === 'email') desc = `Email logged: ${commDirection} — ${commSubject || '(no subject)'}`
    else desc = `Note added${commName ? ` for ${commName}` : ''}`

    await supabase.from('activity_log').insert({
      user_id: merchantUserId,
      merchant_id: merchant?.id || null,
      action_type: 'communication_logged',
      description: desc,
    })

    setCommModal(null)
    setCommSaving(false)
    // Refresh comms list
    if (merchant) fetchRecentComms(merchant.id, merchant.lead_id, showAllComms)
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    if (!templateId) return
    const tpl = emailTemplates.find((t: any) => t.id === templateId)
    if (tpl) {
      setCommSubject(tpl.subject)
      setCommBody(tpl.body)
    }
  }

  useEffect(() => {
    if (authLoading) return
    const fetchMerchant = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMerchantUserId(user.id)

      // Fetch email templates
      const { data: tpls } = await supabase.from('email_templates').select('id, name, subject, body').eq('user_id', user.id).order('name')
      if (tpls) setEmailTemplates(tpls)

      const { data } = await supabase.from('merchants').select('id, lead_id, assigned_to, user_id, created_at, business_name, dba_name, legal_name, status, contact_name, email, phone, mid, processor, notes, business_street, business_city, business_state, business_zip, pricing_type, pricing_rate, per_transaction_fee, monthly_fees, ic_plus_visa_pct, ic_plus_mc_pct, ic_plus_amex_pct, ic_plus_disc_pct, ic_plus_visa_txn, ic_plus_mc_txn, ic_plus_amex_txn, ic_plus_disc_txn, interchange_remittance, dual_pricing_rate, dual_pricing_txn_fee, flat_rate_pct, flat_rate_txn_cost, fee_chargeback, fee_retrieval, fee_arbitration, fee_voice_auth, fee_ebt_auth, fee_ach_reject, monthly_fee_statement, monthly_fee_custom_name, monthly_fee_custom_amount, pci_compliance_monthly, pci_compliance_annual, monthly_volume, last_month_residual, average_residual, chargeback_count, chargeback_volume, chargeback_ratio, boarding_date, contract_length_months, contract_end_date, terminal_type, terminal_serial, equipment_cost, free_equipment, hardware_items, software_items, partner_pricing_overrides').eq('id', params.id).single()
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
        // Fetch residuals and comms for right column
        fetchResidualHistory(data.id)
        fetchRecentComms(data.id, data.lead_id)
      }
      setLoading(false)
    }
    fetchMerchant()
  }, [params.id, authLoading])

  // Fire-and-forget: sync calculated residual metrics back to merchant record
  useEffect(() => {
    if (!merchant?.id || !residualFetched || residualRecords.length === 0) return
    const updates: Record<string, number> = {}
    if (calcLastMonthResidual != null) updates.last_month_residual = Math.round(calcLastMonthResidual * 100) / 100
    if (calcAvgResidual != null) updates.average_residual = Math.round(calcAvgResidual * 100) / 100
    if (Object.keys(updates).length > 0) {
      supabase.from('merchants').update(updates).eq('id', merchant.id).then(() => {})
    }
  }, [merchant?.id, residualFetched, residualRecords.length])

  const fetchTasks = useCallback(async () => {
    const { data: taskData } = await supabase.from('tasks').select('id, title, due_date, priority, status').eq('merchant_id', params.id).eq('status', 'pending').order('due_date', { ascending: true })
    if (taskData) setMerchantTasks(taskData)
    setTaskToast(true)
    setTimeout(() => setTaskToast(false), 2000)
  }, [params.id])

  const updateField = (field: string, value: any) => {
    setMerchant({ ...merchant, [field]: value })
  }

  // Auto-sync summary pricing fields when detail fields change
  useEffect(() => {
    if (!merchant) return
    const updates: Record<string, any> = {}
    // Pricing rate = Visa %
    const visaPct = merchant.ic_plus_visa_pct
    if (visaPct != null && visaPct !== merchant.pricing_rate) {
      updates.pricing_rate = visaPct
    }
    // Per-transaction fee = Visa txn
    const visaTxn = merchant.ic_plus_visa_txn
    if (visaTxn != null && visaTxn !== merchant.per_transaction_fee) {
      updates.per_transaction_fee = visaTxn
    }
    // Monthly fees = sum of statement + custom + PCI
    const sf = parseFloat(merchant.monthly_fee_statement) || 0
    const cf = parseFloat(merchant.monthly_fee_custom_amount) || 0
    const pci = parseFloat(merchant.pci_compliance_monthly) || (merchant.pci_compliance_annual ? parseFloat(merchant.pci_compliance_annual) / 12 : 0) || 0
    const totalFees = Math.round((sf + cf + pci) * 100) / 100
    if (totalFees !== merchant.monthly_fees && (sf > 0 || cf > 0 || pci > 0)) {
      updates.monthly_fees = totalFees
    }
    if (Object.keys(updates).length > 0) {
      setMerchant((prev: any) => ({ ...prev, ...updates }))
    }
  }, [merchant?.ic_plus_visa_pct, merchant?.ic_plus_visa_txn, merchant?.monthly_fee_statement, merchant?.monthly_fee_custom_amount, merchant?.pci_compliance_monthly, merchant?.pci_compliance_annual])

  const handleSave = async () => {
    if (!merchant.business_name?.trim()) {
      setError('Business name is required')
      return
    }
    setSaving(true)
    setError('')

    const { id, created_at, user_id, lead_id, ...updates } = merchant
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
  const labelClass = 'text-base text-slate-600 block mb-1'
  const sectionClass = 'bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-4'

  const chargebackRatio = parseFloat(merchant?.chargeback_ratio) || 0
  const chargebackCount = parseInt(merchant?.chargeback_count) || 0

  const fmtDollar = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-50 text-slate-600 border-slate-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  if (authLoading || loading) return <LoadingScreen />

  if (permissionDenied) return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />
      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-500 mb-6">You don&apos;t have permission to view this merchant.</p>
          <Link href="/dashboard/merchants" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Back to Merchants</Link>
        </div>
      </div>
    </div>
  )
  if (!merchant) return <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8">Merchant not found</div>

  // Compute MIDs for snapshot
  const mids = (merchant.mid || '').split(',').map((s: string) => s.trim()).filter(Boolean)

  // Compute residual chart data
  const residualByMonth: Record<string, any[]> = {}
  for (const r of residualRecords) {
    const key = r.report_month || 'Unknown'
    if (!residualByMonth[key]) residualByMonth[key] = []
    residualByMonth[key].push(r)
  }
  const residualMonthKeys = Object.keys(residualByMonth).sort((a, b) => a.localeCompare(b))
  const chartMonths = residualMonthKeys.slice(-6)
  const chartData = chartMonths.map(k => {
    const recs = residualByMonth[k]
    const rev = recs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0)
    const exp = recs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0)
    return { month: k, net: rev - exp }
  })
  const allMonthNets = residualMonthKeys.map(k => {
    const recs = residualByMonth[k]
    const rev = recs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0)
    const exp = recs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0)
    return rev - exp
  })
  const residualAvg = allMonthNets.length > 0 ? allMonthNets.reduce((a, b) => a + b, 0) / allMonthNets.length : 0
  const residualTotal = allMonthNets.reduce((a, b) => a + b, 0)
  const chartMax = chartData.length > 0 ? Math.max(...chartData.map(d => Math.abs(d.net)), 1) : 1

  // Compute snapshot metrics from residual data
  const hasResidualData = residualFetched && residualMonthKeys.length > 0
  const latestMonthKey = hasResidualData ? residualMonthKeys[residualMonthKeys.length - 1] : null
  const latestMonthRecs = latestMonthKey ? residualByMonth[latestMonthKey] : []

  const calcLastMonthResidual = hasResidualData
    ? latestMonthRecs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0) - latestMonthRecs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0)
    : null
  const calcAvgResidual = hasResidualData ? residualAvg : null
  const calcMonthlyVolume = hasResidualData
    ? latestMonthRecs.reduce((s: number, r: any) => s + (r.sales_amount || 0), 0)
    : null

  // Snapshot display values
  const snapshotVolume = merchant.monthly_volume ? parseFloat(merchant.monthly_volume) : (calcMonthlyVolume || null)
  const snapshotVolumeFromResiduals = !merchant.monthly_volume && calcMonthlyVolume != null
  const snapshotLastResidual = calcLastMonthResidual != null ? calcLastMonthResidual : (merchant.last_month_residual != null ? parseFloat(merchant.last_month_residual) : null)
  const snapshotLastResidualFromResiduals = calcLastMonthResidual != null
  const snapshotAvgResidual = calcAvgResidual != null ? calcAvgResidual : (merchant.average_residual != null ? parseFloat(merchant.average_residual) : null)
  const snapshotAvgResidualFromResiduals = calcAvgResidual != null

  const fmtShortMonth = (key: string) => {
    if (key === 'Unknown') return '?'
    const [y, m] = key.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1)
    return d.toLocaleDateString('en-US', { month: 'short' })
  }

  const fmtFullMonth = (key: string) => {
    if (key === 'Unknown') return key
    const [y, m] = key.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Relative time helper
  const relativeTime = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const commIcon = (type: string) => {
    if (type === 'call') return '📞'
    if (type === 'email') return '✉️'
    return '📝'
  }

  // Task helpers
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <Link href="/dashboard/merchants" className="text-slate-400 hover:text-slate-900 text-sm transition">← Back to Merchants</Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mt-4">{error}</div>
        )}

        {/* STEP 1 — MERCHANT SNAPSHOT HEADER */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 mt-4">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{merchant.business_name}</h2>
              {merchant.dba_name && merchant.dba_name !== merchant.business_name && (
                <p className="text-sm text-slate-500">DBA: {merchant.dba_name}</p>
              )}
              {merchant.lead_id && (
                <Link href={`/dashboard/leads/${merchant.lead_id}`} className="text-emerald-600 hover:text-emerald-700 text-sm transition">
                  View Original Lead →
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {msg && <span className="text-emerald-600 text-sm">{msg}</span>}
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${statusColors[merchant.status] || statusColors.active}`}>
                {(merchant.status || 'active').charAt(0).toUpperCase() + (merchant.status || 'active').slice(1)}
              </span>
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

          {/* Second row — stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
            <div>
              <p className="text-xs text-slate-500">Monthly Volume</p>
              <p className="text-lg font-semibold text-slate-900">
                {snapshotVolume != null ? fmtDollar(snapshotVolume) : '—'}
              </p>
              {snapshotVolumeFromResiduals && <p className="text-xs text-slate-400">📊 from residuals</p>}
            </div>
            <div>
              <p className="text-xs text-slate-500">Last Month Residual</p>
              <p className={`text-lg font-semibold ${snapshotLastResidual != null ? (snapshotLastResidual >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-900'}`}>
                {snapshotLastResidual != null ? fmtDollar(snapshotLastResidual) : '—'}
              </p>
              {snapshotLastResidualFromResiduals && <p className="text-xs text-slate-400">📊 from residuals</p>}
            </div>
            <div>
              <p className="text-xs text-slate-500">Average Residual</p>
              <p className={`text-lg font-semibold ${snapshotAvgResidual != null ? (snapshotAvgResidual >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-900'}`}>
                {snapshotAvgResidual != null ? fmtDollar(snapshotAvgResidual) : '—'}
              </p>
              {snapshotAvgResidualFromResiduals && <p className="text-xs text-slate-400">📊 from residuals</p>}
            </div>
            <div>
              <p className="text-xs text-slate-500">MIDs</p>
              <p className="text-lg font-semibold text-slate-900">{mids.length}</p>
              {mids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {mids.map((mid: string) => (
                    <span key={mid} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{mid}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Toast */}
        {taskToast && (
          <p className="text-emerald-600 text-sm font-medium mb-2">✅ Follow-up created</p>
        )}

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            onClose={() => setShowTaskModal(false)}
            onSaved={fetchTasks}
            merchantId={merchant.id}
            linkedEntityName={merchant.dba_name || merchant.legal_name}
          />
        )}

        {/* STEP 2 — 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT COLUMN (60%) — Collapsible form groups */}
          <div className="lg:col-span-3 space-y-2">

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
                        const currentMids = (merchant.mid || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                        const removeMid = (midToRemove: string) => {
                          const updated = currentMids.filter((m: string) => m !== midToRemove).join(', ')
                          updateField('mid', updated || null)
                        }
                        const addMid = () => {
                          const val = newMidInput.trim()
                          if (!val) return
                          if (currentMids.includes(val)) {
                            setMidDuplicate(true)
                            setTimeout(() => setMidDuplicate(false), 1500)
                            return
                          }
                          const updated = currentMids.length > 0 ? [...currentMids, val].join(', ') : val
                          updateField('mid', updated)
                          setNewMidInput('')
                        }
                        return (
                          <div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {currentMids.map((mid: string) => (
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
                            {currentMids.length === 0 && !newMidInput && <p className="text-xs text-slate-400 mt-1">No MIDs assigned</p>}
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
                    <div>
                      <label className={labelClass}>Risk Category</label>
                      <select value={merchant.risk_category || 'standard'} onChange={(e) => updateField('risk_category', e.target.value)} className={inputClass}>
                        <option value="standard">Standard</option>
                        <option value="restricted">Restricted</option>
                        <option value="high_risk">High Risk</option>
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
                  <h4 className="text-base font-semibold text-slate-700 mb-4">Rate Details</h4>
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
                  <h4 className="text-base font-semibold text-slate-700 mb-4">Misc Fees ($)</h4>
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
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className={labelClass}>EBT Auths</label>
                        <input type="number" step="0.01" value={merchant.fee_ebt_auth ?? ''} onChange={(e) => updateField('fee_ebt_auth', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
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
                  <h4 className="text-base font-semibold text-slate-700 mb-4">Monthly Fees</h4>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className={labelClass}>Statement Fee ($)</label>
                        <input type="number" step="0.01" value={merchant.monthly_fee_statement ?? ''} onChange={(e) => updateField('monthly_fee_statement', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>PCI Type</label>
                        <select value={merchant.pci_compliance_monthly ? 'monthly' : merchant.pci_compliance_annual ? 'annual' : ''} onChange={(e) => {
                          const currentAmount = merchant.pci_compliance_monthly ?? merchant.pci_compliance_annual ?? null;
                          if (e.target.value === 'monthly') {
                            setMerchant({ ...merchant, pci_compliance_monthly: currentAmount, pci_compliance_annual: null });
                          } else if (e.target.value === 'annual') {
                            setMerchant({ ...merchant, pci_compliance_annual: currentAmount, pci_compliance_monthly: null });
                          } else {
                            setMerchant({ ...merchant, pci_compliance_monthly: null, pci_compliance_annual: null });
                          }
                        }} className={inputClass}>
                          <option value="">Select...</option>
                          <option value="monthly">Monthly</option>
                          <option value="annual">Annual</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>PCI Amount ($)</label>
                        <input type="number" step="0.01" value={merchant.pci_compliance_monthly ?? merchant.pci_compliance_annual ?? ''} onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          if (merchant.pci_compliance_annual) {
                            updateField('pci_compliance_annual', val);
                          } else {
                            updateField('pci_compliance_monthly', val);
                          }
                        }} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>Custom Fee Name</label>
                        <input type="text" value={merchant.monthly_fee_custom_name || ''} onChange={(e) => updateField('monthly_fee_custom_name', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Custom Fee Amount ($)</label>
                        <input type="number" step="0.01" value={merchant.monthly_fee_custom_amount ?? ''} onChange={(e) => updateField('monthly_fee_custom_amount', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Partner Schedule (read-only, from deal conversion) */}
            {merchant.partner_pricing_overrides && Object.keys(merchant.partner_pricing_overrides).length > 0 && (
              <div className={sectionClass + ' mb-4'}>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Partner Schedule</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(merchant.partner_pricing_overrides).map(([key, val]) => (
                    <div key={key}>
                      <label className={labelClass}>{key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</label>
                      <p className="text-sm text-slate-900 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">{val as string}</p>
                    </div>
                  ))}
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

                  {/* Hardware Items from Deal */}
                  {merchant.hardware_items && Array.isArray(merchant.hardware_items) && merchant.hardware_items.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Hardware Items</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {merchant.hardware_items.map((item: any, idx: number) => (
                          <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-slate-900 capitalize">{item.type?.replace('_', ' ') || 'Hardware'}</p>
                                {item.model && <p className="text-xs text-slate-500">{item.model}</p>}
                              </div>
                              <div className="text-right">
                                {item.quantity && <span className="text-xs text-slate-500">Qty: {item.quantity}</span>}
                              </div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                              {item.cost && <span>Cost: ${item.cost}</span>}
                              {item.free === 'yes' && <span className="text-emerald-600 font-medium">Free Placement</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Software Items from Deal */}
                  {merchant.software_items && Array.isArray(merchant.software_items) && merchant.software_items.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Software / Gateways</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {merchant.software_items.map((item: any, idx: number) => (
                          <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-sm font-medium text-slate-900">{item.name || 'Software'}</p>
                            {item.type && <p className="text-xs text-slate-500 capitalize">{item.type.replace('_', ' ')}</p>}
                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                              {item.monthly_cost && <span>${item.monthly_cost}/mo</span>}
                              {item.per_txn && <span>${item.per_txn}/txn</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
          </div>

          {/* RIGHT COLUMN (40%) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Action Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => openCommModal('call')} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition">
                  📞 Log Call
                </button>
                {merchant.phone && (
                  <a
                    href={`tel:${merchant.phone}`}
                    onClick={() => { navigator.clipboard.writeText(merchant.phone).then(() => { setPhoneCopied(true); setTimeout(() => setPhoneCopied(false), 2000) }) }}
                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  >
                    {phoneCopied ? 'Copied!' : merchant.phone}
                  </a>
                )}
                {merchant.email ? (
                  <a
                    href={`mailto:${merchant.email}`}
                    onClick={(e) => { e.preventDefault(); window.open(`mailto:${merchant.email}`); setTimeout(() => openCommModal('email'), 1000) }}
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition"
                  >
                    ✉️ Send Email
                  </a>
                ) : (
                  <span className="bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed" title="No email on file">
                    ✉️ Send Email
                  </span>
                )}
                <button onClick={() => openCommModal('note')} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition">
                  📝 Add Note
                </button>
                <button onClick={() => setShowCommTaskModal(true)} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition">
                  📋 Follow-up
                </button>
              </div>
            </div>

            {/* Follow-up Task Modal from action bar */}
            {showCommTaskModal && (
              <TaskModal
                onClose={() => setShowCommTaskModal(false)}
                onSaved={async () => {
                  await supabase.from('activity_log').insert({
                    user_id: merchantUserId,
                    merchant_id: merchant.id,
                    action_type: 'communication_logged',
                    description: 'Follow-up task created',
                  })
                  fetchTasks()
                  setShowCommTaskModal(false)
                }}
                merchantId={merchant.id}
                linkedEntityName={merchant.dba_name || merchant.contact_name}
              />
            )}

            {/* Communication Modal */}
            {commModal && (
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
                            <input type="text" value={commName} onChange={(e) => setCommName(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                          </div>
                          <div>
                            <label className="text-sm text-slate-600 font-medium block mb-1.5">Phone Number</label>
                            <input type="tel" value={commPhone} onChange={(e) => setCommPhone(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium block mb-1.5">Notes</label>
                          <textarea value={commBody} onChange={(e) => setCommBody(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm h-24 resize-none" rows={4} />
                        </div>
                      </div>
                    </>
                  )}

                  {commModal === 'email' && (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Log Email</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-slate-600 font-medium block mb-1.5">Direction</label>
                          <div className="flex gap-2">
                            {['sent', 'received'].map((d) => (
                              <button key={d} onClick={() => setCommDirection(d)} className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${commDirection === d ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium block mb-1.5">{commDirection === 'sent' ? 'To' : 'From'}</label>
                          <input type="email" value={commEmail} onChange={(e) => setCommEmail(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium block mb-1.5">Template</label>
                          <select value={selectedTemplate} onChange={(e) => handleTemplateSelect(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm">
                            <option value="">No template</option>
                            {emailTemplates.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium block mb-1.5">Subject</label>
                          <input type="text" value={commSubject} onChange={(e) => setCommSubject(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium block mb-1.5">Body</label>
                          <textarea value={commBody} onChange={(e) => setCommBody(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm h-36 resize-none" rows={6} />
                        </div>
                      </div>
                    </>
                  )}

                  {commModal === 'note' && (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Note</h3>
                      <div>
                        <textarea value={commBody} onChange={(e) => setCommBody(e.target.value)} className="w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm h-36 resize-none" rows={6} placeholder="Enter your note..." />
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

            {/* CARD 1 — Residual History Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-base font-semibold text-slate-900">Residual History</h3>
                {residualMonthKeys.length > 0 && (
                  <span className="bg-emerald-50 text-emerald-600 text-xs px-2 py-0.5 rounded-full">{residualMonthKeys.length} month{residualMonthKeys.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {residualLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full mb-3" />
                  <p className="text-slate-400 text-sm">Loading residual history...</p>
                </div>
              ) : chartData.length === 0 ? (
                <div>
                  <p className="text-slate-400 text-sm mb-3">No residual data yet</p>
                  <Link href="/dashboard/residuals" className="text-emerald-600 text-sm hover:underline">Import Residuals →</Link>
                </div>
              ) : (
                <div>
                  {/* Bar chart */}
                  <div className="flex items-end gap-2 h-40 mb-2">
                    {chartData.map((d) => {
                      const barHeight = Math.max((Math.abs(d.net) / chartMax) * 100, 4)
                      return (
                        <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className={`w-full rounded-t-md ${d.net >= 0 ? 'bg-emerald-500' : 'bg-red-400'} relative group`}
                            style={{ height: `${barHeight}%` }}
                            title={fmtDollar(d.net)}
                          >
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {fmtDollar(d.net)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    {chartData.map((d) => (
                      <div key={d.month} className="flex-1 text-center">
                        <span className="text-xs text-slate-400">{fmtShortMonth(d.month)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-slate-500 mt-3">
                    Avg: {fmtDollar(residualAvg)}/mo | Total: {fmtDollar(residualTotal)}
                  </p>

                  {/* View Full Details */}
                  <button
                    onClick={() => setShowFullResiduals(!showFullResiduals)}
                    className="text-emerald-600 text-sm hover:underline mt-2"
                  >
                    {showFullResiduals ? 'Hide Details ↑' : 'View Full Details ↓'}
                  </button>

                  {/* Expanded residual details */}
                  {showFullResiduals && (
                    <div className="mt-4 space-y-3">
                      {residualMonthKeys.sort((a, b) => b.localeCompare(a)).map(monthKey => {
                        const recs = residualByMonth[monthKey]
                        const volume = recs.reduce((s: number, r: any) => s + (r.sales_amount || 0), 0)
                        const revenue = recs.reduce((s: number, r: any) => s + (r.gross_income || 0), 0)
                        const expenses = recs.reduce((s: number, r: any) => s + (r.total_expenses || 0), 0)
                        const transactions = recs.reduce((s: number, r: any) => s + (r.sales_count || 0), 0)
                        const net = revenue - expenses
                        const isExpanded = expandedMonths[monthKey] || false

                        return (
                          <div key={monthKey} className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-slate-900">{fmtFullMonth(monthKey)}</span>
                              <span className={`text-sm font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtDollar(net)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div>
                                <p className="text-xs text-slate-500">Volume</p>
                                <p className="text-xs font-medium text-slate-900">{fmtDollar(volume)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Revenue</p>
                                <p className="text-xs font-medium text-slate-900">{fmtDollar(revenue)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Expenses</p>
                                <p className="text-xs font-medium text-red-600">{fmtDollar(expenses)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Transactions</p>
                                <p className="text-xs font-medium text-slate-900">{transactions.toLocaleString()}</p>
                              </div>
                            </div>
                            <span
                              onClick={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))}
                              className="text-emerald-600 text-xs cursor-pointer hover:underline inline-block mt-2"
                            >
                              {isExpanded ? 'Hide Details' : 'View Details'}
                            </span>
                            {isExpanded && (
                              <div className="mt-2 overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-slate-100">
                                      <th className="text-left px-2 py-1 text-xs text-slate-500 uppercase font-medium">Category</th>
                                      <th className="text-right px-2 py-1 text-xs text-slate-500 uppercase font-medium">Sales</th>
                                      <th className="text-right px-2 py-1 text-xs text-slate-500 uppercase font-medium">Expenses</th>
                                      <th className="text-right px-2 py-1 text-xs text-slate-500 uppercase font-medium">Income</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {recs.map((rec: any) => {
                                      const fmtCell = (val: number | null) => {
                                        if (val == null) return <span className="text-slate-300">—</span>
                                        return <span className={val < 0 ? 'text-red-600' : ''} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDollar(val)}</span>
                                      }
                                      return (
                                        <tr key={rec.id} className="border-b border-slate-100 text-xs">
                                          <td className="px-2 py-1 text-slate-500">{rec.fee_category || rec.description || '—'}</td>
                                          <td className="px-2 py-1 text-right">{fmtCell(rec.sales_amount)}</td>
                                          <td className="px-2 py-1 text-right">{fmtCell(rec.total_expenses)}</td>
                                          <td className="px-2 py-1 text-right">{fmtCell(rec.gross_income)}</td>
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
                  )}
                </div>
              )}
            </div>

            {/* CARD 2 — Upcoming Tasks */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Upcoming Tasks</h3>
                  {merchantTasks.length > 0 && (
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{merchantTasks.length}</span>
                  )}
                </div>
                <button onClick={() => setShowTaskModal(true)} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">+ Add</button>
              </div>
              {merchantTasks.length === 0 ? (
                <p className="text-slate-400 text-sm">No upcoming tasks</p>
              ) : (
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
              )}
            </div>

            {/* CARD 3 — Communications */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Communications</h3>
              {commsLoading ? (
                <p className="text-slate-400 text-sm">Loading...</p>
              ) : recentComms.length === 0 ? (
                <p className="text-slate-400 text-sm">No communications yet. Log a call, send an email, or add a note to get started.</p>
              ) : (
                <div>
                  {recentComms.map((comm, i) => (
                    <div
                      key={comm.id}
                      className={`py-2 ${i < recentComms.length - 1 ? 'border-b border-slate-50' : ''}`}
                    >
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setExpandedComms(prev => ({ ...prev, [comm.id]: !prev[comm.id] }))}
                      >
                        <span className="text-xs">{commIcon(comm.type)}</span>
                        <span className="text-xs text-slate-700 flex-1 truncate">
                          {comm.subject || comm.body?.slice(0, 60) || comm.type}
                        </span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">{relativeTime(comm.logged_at)}</span>
                      </div>
                      {expandedComms[comm.id] && comm.body && (
                        <p className="text-xs text-slate-500 mt-1 pl-6 whitespace-pre-wrap">{comm.body}</p>
                      )}
                    </div>
                  ))}
                  {!showAllComms && recentComms.length >= 5 && (
                    <button
                      onClick={() => { setShowAllComms(true); fetchRecentComms(merchant.id, merchant.lead_id, true) }}
                      className="text-emerald-600 text-sm hover:underline mt-2"
                    >
                      View All →
                    </button>
                  )}
                  {showAllComms && (
                    <button
                      onClick={() => { setShowAllComms(false); fetchRecentComms(merchant.id, merchant.lead_id, false) }}
                      className="text-slate-400 text-sm hover:underline mt-2"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
