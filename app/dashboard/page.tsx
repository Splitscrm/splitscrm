'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import WelcomeWizard from '@/components/WelcomeWizard'
import OnboardingChecklist from '@/components/OnboardingChecklist'
import TaskModal from '@/components/TaskModal'
import { useAuth } from '@/lib/auth-context'

const STATUS_LABELS: Record<string, string> = {
  new_prospect: 'New Prospect',
  contact_pending: 'Contact Pending',
  pending_qualification: 'Pending Qualification',
  qualified_prospect: 'Qualified Prospect',
  submitted: 'Submitted',
  signed: 'Signed',
  converted: 'Converted',
  unqualified: 'Unqualified',
  unresponsive: 'Unresponsive',
  recycled: 'Recycled',
}

const STATUS_COLORS: Record<string, string> = {
  new_prospect: 'bg-blue-500',
  contact_pending: 'bg-sky-500',
  pending_qualification: 'bg-amber-500',
  qualified_prospect: 'bg-emerald-500',
  submitted: 'bg-purple-500',
  signed: 'bg-teal-500',
  converted: 'bg-emerald-600',
  unqualified: 'bg-red-500',
  unresponsive: 'bg-slate-400',
  recycled: 'bg-cyan-500',
}


const PROCESSOR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']

const ACTIVITY_DOT_COLORS: Record<string, string> = {
  deal_created: 'bg-blue-500',
  deal_updated: 'bg-blue-500',
  stage_change: 'bg-green-500',
  document_uploaded: 'bg-purple-500',
  document_deleted: 'bg-red-500',
  deal_deleted: 'bg-red-500',
  merchant_deleted: 'bg-red-500',
  owner_removed: 'bg-red-500',
  owner_added: 'bg-yellow-500',
  task_created: 'bg-indigo-500',
  task_completed: 'bg-emerald-500',
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`
}

interface DashboardData {
  activeMerchants: number
  pendingMerchants: number
  pipelineValue: number
  activeDeals: number
  leadsThisMonth: number
  conversionRate: number
  activePartners: number
  totalPartners: number
  pipelineByStatus: { status: string; count: number }[]
  followUps: { id: string; business_name: string; contact_name: string; follow_up_date: string }[]
  tasks: { id: string; title: string; description: string; due_date: string; due_time: string; priority: string; status: string; lead_id: string | null; merchant_id: string | null }[]
  merchantsByProcessor: { processor: string; count: number }[]
  recentActivity: { id: string; action_type: string; description: string; created_at: string }[]
  latestImport: { processor_name: string | null; report_month: string | null } | null
  residualNetRevenue: number
  residualTotalVolume: number
  agentBreakdown: { agent: string; merchantCount: number }[]
  topMerchants: { merchantIdExternal: string; dbaName: string; netProfit: number; merchantId: string | null }[]
}

export default function Dashboard() {
  const router = useRouter()
  const { org, member, user: authUser } = useAuth()
  const role = member?.role || 'owner'
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [onboarding, setOnboarding] = useState<any>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [data, setData] = useState<DashboardData>({
    activeMerchants: 0,
    pendingMerchants: 0,
    pipelineValue: 0,
    activeDeals: 0,
    leadsThisMonth: 0,
    conversionRate: 0,
    activePartners: 0,
    totalPartners: 0,
    pipelineByStatus: [],
    followUps: [],
    tasks: [],
    merchantsByProcessor: [],
    recentActivity: [],
    latestImport: null,
    residualNetRevenue: 0,
    residualTotalVolume: 0,
    agentBreakdown: [],
    topMerchants: [],
  })

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // Check onboarding status
      const { data: onboardingData } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!onboardingData) {
        const defaults = {
          user_id: user.id,
          wizard_completed: false,
          profile_completed: false,
          first_partner_added: false,
          first_pricing_uploaded: false,
          first_residual_imported: false,
          first_lead_added: false,
          onboarding_dismissed: false,
        }
        await supabase.from('user_onboarding').insert(defaults)
        setOnboarding(defaults)
        setShowWizard(true)
      } else {
        setOnboarding(onboardingData)
        if (!onboardingData.wizard_completed) {
          setShowWizard(true)
        }
      }

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const today = now.toISOString().split('T')[0]

      // Build role-aware queries: agents only see their own data
      const addRoleFilter = (query: any) => {
        if (!isOwnerOrManager) {
          return query.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
        }
        return query
      }

      const [
        { count: activeMerchants },
        { count: pendingMerchants },
        { data: allDealsWithLeads },
        { count: leadsThisMonth },
        { count: totalLeads },
        { count: convertedLeads },
        { count: activePartners },
        { count: totalPartners },
        { data: allLeads },
        { data: followUps },
        { data: allMerchants },
        { data: recentActivity },
        { data: tasks },
      ] = await Promise.all([
        addRoleFilter(supabase.from('merchants').select('*', { count: 'exact', head: true }).eq('status', 'active')),
        addRoleFilter(supabase.from('merchants').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
        isOwnerOrManager
          ? supabase.from('deals').select('monthly_volume, lead_id, leads!inner(status)')
          : supabase.from('deals').select('monthly_volume, lead_id, leads!inner(status)').eq('user_id', user.id),
        addRoleFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', monthStart)),
        addRoleFilter(supabase.from('leads').select('*', { count: 'exact', head: true })),
        addRoleFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted')),
        isOwnerOrManager ? supabase.from('partners').select('*', { count: 'exact', head: true }).eq('status', 'active') : Promise.resolve({ count: 0 }),
        isOwnerOrManager ? supabase.from('partners').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
        addRoleFilter(supabase.from('leads').select('status')),
        addRoleFilter(supabase.from('leads').select('id, business_name, contact_name, follow_up_date')
          .not('follow_up_date', 'is', null)
          .gte('follow_up_date', today)
          .order('follow_up_date', { ascending: true })
          .limit(5)),
        addRoleFilter(supabase.from('merchants').select('processor')),
        isOwnerOrManager
          ? supabase.from('activity_log').select('id, action_type, description, created_at').order('created_at', { ascending: false }).limit(5)
          : supabase.from('activity_log').select('id, action_type, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('tasks').select('id, title, description, due_date, due_time, priority, status, lead_id, merchant_id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('due_date', { ascending: true })
          .limit(7),
      ])

      // Pipeline value: sum monthly_volume from deals where lead status is not converted/unqualified/unresponsive
      const excludeStatuses = ['converted', 'unqualified', 'unresponsive']
      let pipelineValue = 0
      let activeDeals = 0
      if (allDealsWithLeads) {
        for (const deal of allDealsWithLeads) {
          const leadStatus = (deal as any).leads?.status
          if (leadStatus && !excludeStatuses.includes(leadStatus)) {
            pipelineValue += Number(deal.monthly_volume) || 0
            activeDeals++
          }
        }
      }

      // Pipeline by status
      const statusCounts: Record<string, number> = {}
      if (allLeads) {
        for (const lead of allLeads) {
          const s = (lead as any).status || 'unknown'
          statusCounts[s] = (statusCounts[s] || 0) + 1
        }
      }
      const pipelineByStatus = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => {
          const order = Object.keys(STATUS_LABELS)
          return order.indexOf(a.status) - order.indexOf(b.status)
        })

      // Merchants by processor
      const processorCounts: Record<string, number> = {}
      if (allMerchants) {
        for (const m of allMerchants) {
          const p = (m as any).processor || 'Unassigned'
          processorCounts[p] = (processorCounts[p] || 0) + 1
        }
      }
      const merchantsByProcessor = Object.entries(processorCounts)
        .map(([processor, count]) => ({ processor, count }))
        .sort((a, b) => b.count - a.count)

      // Conversion rate
      const total = totalLeads || 0
      const converted = convertedLeads || 0
      const conversionRate = total > 0 ? (converted / total) * 100 : 0

      // Residual data — fetch latest import then its records
      let latestImport: DashboardData['latestImport'] = null
      let residualNetRevenue = 0
      let residualTotalVolume = 0
      let agentBreakdown: DashboardData['agentBreakdown'] = []
      let topMerchants: DashboardData['topMerchants'] = []

      const { data: latestImportRow } = await supabase
        .from('residual_imports')
        .select('id, processor_name, report_month')
        .eq('status', 'imported')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestImportRow) {
        latestImport = {
          processor_name: latestImportRow.processor_name,
          report_month: latestImportRow.report_month,
        }

        const { data: records } = await supabase
          .from('residual_records')
          .select('gross_income, total_expenses, sales_amount, agent_id_external, merchant_id_external, dba_name, merchant_id')
          .eq('import_id', latestImportRow.id)

        if (records) {
          console.log('Residual records sample (first 3):', records.slice(0, 3))

          let totalGrossIncome = 0
          let totalExpenses = 0
          for (const r of records) {
            totalGrossIncome += r.gross_income || 0
            totalExpenses += r.total_expenses || 0
            residualTotalVolume += r.sales_amount || 0
          }
          residualNetRevenue = totalGrossIncome - totalExpenses

          const agentMap: Record<string, Set<string>> = {}
          for (const r of records) {
            const agent = r.agent_id_external || 'Unassigned'
            const mid = r.merchant_id_external
            if (!agentMap[agent]) agentMap[agent] = new Set()
            if (mid) agentMap[agent].add(mid)
          }
          agentBreakdown = Object.entries(agentMap)
            .map(([agent, mids]) => ({ agent, merchantCount: mids.size }))
            .sort((a, b) => b.merchantCount - a.merchantCount)

          // Top merchants by profitability
          const merchantProfitMap: Record<string, { dbaName: string; grossIncome: number; totalExpenses: number; merchantId: string | null }> = {}
          for (const r of records) {
            const key = r.merchant_id_external || r.dba_name || 'Unknown'
            if (!merchantProfitMap[key]) {
              merchantProfitMap[key] = { dbaName: r.dba_name || r.merchant_id_external || 'Unknown', grossIncome: 0, totalExpenses: 0, merchantId: r.merchant_id || null }
            }
            merchantProfitMap[key].grossIncome += r.gross_income || 0
            merchantProfitMap[key].totalExpenses += r.total_expenses || 0
            if (r.merchant_id && !merchantProfitMap[key].merchantId) merchantProfitMap[key].merchantId = r.merchant_id
          }
          topMerchants = Object.entries(merchantProfitMap)
            .map(([mid, m]) => ({ merchantIdExternal: mid, dbaName: m.dbaName, netProfit: m.grossIncome - m.totalExpenses, merchantId: m.merchantId }))
            .sort((a, b) => b.netProfit - a.netProfit)
            .slice(0, 5)
        }
      }

      setData({
        activeMerchants: activeMerchants || 0,
        pendingMerchants: pendingMerchants || 0,
        pipelineValue,
        activeDeals,
        leadsThisMonth: leadsThisMonth || 0,
        conversionRate,
        activePartners: activePartners || 0,
        totalPartners: totalPartners || 0,
        pipelineByStatus,
        followUps: (followUps as any) || [],
        tasks: (tasks as any) || [],
        merchantsByProcessor,
        recentActivity: (recentActivity as any) || [],
        latestImport,
        residualNetRevenue,
        residualTotalVolume,
        agentBreakdown,
        topMerchants,
      })

      setLoading(false)
    }
    loadDashboard()
  }, [])

  // One-time backfill: set org_id and assigned_to on existing records
  useEffect(() => {
    if (!user || !org?.id) return
    const backfill = async () => {
      const tables = ['leads', 'merchants', 'partners', 'deals', 'tasks', 'residual_imports'] as const
      let totalBackfilled = 0
      for (const table of tables) {
        // Backfill org_id
        const { count: orgCount } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('org_id', null)
        if (orgCount && orgCount > 0) {
          await supabase
            .from(table)
            .update({ org_id: org.id })
            .eq('user_id', user.id)
            .is('org_id', null)
          totalBackfilled += orgCount
        }
      }

      // Backfill assigned_to on leads and merchants
      const assignableTables = ['leads', 'merchants'] as const
      for (const table of assignableTables) {
        const { count: assignCount } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('assigned_to', null)
        if (assignCount && assignCount > 0) {
          await supabase
            .from(table)
            .update({ assigned_to: user.id })
            .eq('user_id', user.id)
            .is('assigned_to', null)
          totalBackfilled += assignCount
        }
      }

      if (totalBackfilled > 0) {
        console.log(`Backfilled org_id/assigned_to on ${totalBackfilled} records`)
      }
    }
    backfill()
  }, [user, org?.id])

  const maxPipelineCount = Math.max(...data.pipelineByStatus.map(s => s.count), 1)
  const maxProcessorCount = Math.max(...data.merchantsByProcessor.map(m => m.count), 1)

  // --- Browser notification reminders ---
  const notifiedTaskIds = useRef<Set<string>>(new Set())
  const notifiedLoadTasks = useRef(false)

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return data.tasks.filter(t => t.due_date && t.due_date < today).length
  }, [data.tasks])

  useEffect(() => {
    if (loading || data.tasks.length === 0) return

    // Request permission (non-blocking)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const canNotify = () =>
      typeof Notification !== 'undefined' && Notification.permission === 'granted'

    const showNotification = (title: string, body: string) => {
      if (!canNotify()) return
      try {
        const n = new Notification(title, { body })
        n.onclick = () => { window.focus(); n.close() }
      } catch {}
    }

    // One-time load notifications
    if (!notifiedLoadTasks.current) {
      notifiedLoadTasks.current = true
      const today = new Date().toISOString().split('T')[0]

      // Overdue tasks
      const overdue = data.tasks.filter(t => t.due_date && t.due_date < today)
      if (overdue.length > 0) {
        showNotification(
          'Splits \u2014 Overdue Tasks',
          `You have ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`
        )
        overdue.forEach(t => notifiedTaskIds.current.add(t.id))
      }

      // Today's tasks without a due_time (morning reminder)
      const todayNoTime = data.tasks.filter(t => t.due_date === today && !t.due_time)
      todayNoTime.forEach(t => {
        if (!notifiedTaskIds.current.has(t.id)) {
          showNotification('Splits \u2014 Task Due Today', t.title + (t.description ? `\n${t.description}` : ''))
          notifiedTaskIds.current.add(t.id)
        }
      })
    }

    // Interval: check timed tasks every 60s
    const interval = setInterval(() => {
      if (!canNotify()) return
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const nowMinutes = now.getHours() * 60 + now.getMinutes()

      data.tasks.forEach(task => {
        if (task.due_date !== today || !task.due_time) return
        if (notifiedTaskIds.current.has(task.id)) return

        const [h, m] = task.due_time.split(':').map(Number)
        const taskMinutes = h * 60 + m
        const diff = nowMinutes - taskMinutes

        if (diff >= 0 && diff <= 5) {
          showNotification('Splits \u2014 Task Due', task.title + (task.description ? `\n${task.description}` : ''))
          notifiedTaskIds.current.add(task.id)
        }
      })
    }, 60_000)

    return () => clearInterval(interval)
  }, [loading, data.tasks])

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Welcome Wizard */}
      {showWizard && <WelcomeWizard onComplete={() => { setShowWizard(false); setOnboarding((prev: any) => prev ? { ...prev, wizard_completed: true, profile_completed: true } : prev) }} />}

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSaved={async () => {
            const { data: refreshed } = await supabase.from('tasks').select('id, title, description, due_date, due_time, priority, status, lead_id, merchant_id').eq('status', 'pending').order('due_date', { ascending: true }).limit(7)
            setData(prev => ({ ...prev, tasks: (refreshed as any) || [] }))
          }}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl lg:text-2xl font-bold">Welcome back 👋</h2>
          <p className="text-slate-500 mt-1">{user?.email}</p>
        </div>

        {loading ? (
          /* Loading Skeleton */
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-20"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-pulse h-64">
                  <div className="h-5 bg-slate-200 rounded w-32 mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-4 bg-slate-200 rounded w-full"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-pulse h-48">
              <div className="h-5 bg-slate-200 rounded w-32 mb-4"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-slate-200 rounded w-full"></div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Onboarding Checklist */}
            {onboarding && onboarding.wizard_completed && !onboarding.onboarding_dismissed &&
              !(onboarding.profile_completed && onboarding.first_partner_added && onboarding.first_pricing_uploaded && onboarding.first_residual_imported && onboarding.first_lead_added) && (
              <OnboardingChecklist
                onboarding={onboarding}
                onUpdate={(updates) => setOnboarding((prev: any) => ({ ...prev, ...updates }))}
                onDismiss={async () => {
                  setOnboarding((prev: any) => ({ ...prev, onboarding_dismissed: true }))
                  if (user) {
                    await supabase.from('user_onboarding').update({ onboarding_dismissed: true, updated_at: new Date().toISOString() }).eq('user_id', user.id)
                  }
                }}
              />
            )}

            {/* Top Row — Key Metric Cards */}
            <div className={`grid grid-cols-2 ${isOwnerOrManager ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
              {/* Active Merchants */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm">{isOwnerOrManager ? 'Active Merchants' : 'My Merchants'}</p>
                <p className="text-3xl font-bold tabular-nums mt-2">{data.activeMerchants.toLocaleString()}</p>
                <p className="text-slate-400 text-sm mt-1">{data.pendingMerchants.toLocaleString()} pending</p>
              </div>

              {/* Pipeline Value */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm">Pipeline Value</p>
                <p className="text-3xl font-bold tabular-nums mt-2">${data.pipelineValue.toLocaleString()}</p>
                <p className="text-slate-400 text-sm mt-1">{data.activeDeals.toLocaleString()} active deals</p>
              </div>

              {/* Leads This Month */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm">{isOwnerOrManager ? 'Leads This Month' : 'My Leads'}</p>
                <p className="text-3xl font-bold tabular-nums mt-2">{data.leadsThisMonth.toLocaleString()}</p>
                <p className="text-slate-400 text-sm mt-1">{data.conversionRate.toFixed(1)}% lifetime conversion</p>
              </div>

              {/* Active Partners — owner/manager only */}
              {isOwnerOrManager && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <p className="text-slate-500 text-sm">Active Partners</p>
                  <p className="text-3xl font-bold tabular-nums mt-2">{data.activePartners.toLocaleString()}</p>
                  <p className="text-slate-400 text-sm mt-1">{data.totalPartners.toLocaleString()} total partners</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap flex-col sm:flex-row gap-3 sm:gap-4">
              <a href="/dashboard/leads/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition">
                + Add Lead
              </a>
              {(isOwnerOrManager || role === 'master_agent' || role === 'agent') && (
                <a href="/dashboard/merchants/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition">
                  + Add Merchant
                </a>
              )}
              {isOwnerOrManager && (
                <a href="/dashboard/partners/new" className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm transition">
                  + Add Partner
                </a>
              )}
              {isOwnerOrManager && (
                <a href="/dashboard/statements" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">
                  📄 Analyze Statement
                </a>
              )}
            </div>

            {/* Middle Row — 2 Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Sales Pipeline */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="font-semibold mb-4">Sales Pipeline</h3>
                  {data.pipelineByStatus.length === 0 ? (
                    <p className="text-slate-400 text-sm">No leads yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.pipelineByStatus.map(({ status, count }) => (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-sm text-slate-500 w-40 shrink-0 truncate">
                            {STATUS_LABELS[status] || status}
                          </span>
                          <div className="flex-1 bg-slate-200 rounded-full h-5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${STATUS_COLORS[status] || 'bg-slate-400'}`}
                              style={{ width: `${(count / maxPipelineCount) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600 w-8 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks & Follow-ups */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Tasks & Follow-ups</h3>
                      {overdueCount > 0 && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                    </div>
                    <button
                      onClick={() => setShowTaskModal(true)}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                    >
                      + Add
                    </button>
                  </div>
                  {data.tasks.length === 0 && data.followUps.length === 0 ? (
                    <p className="text-slate-400 text-sm">No pending tasks or follow-ups</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Tasks from tasks table */}
                      {data.tasks.map((task) => {
                        const priorityColors: Record<string, string> = {
                          low: 'bg-slate-100 text-slate-600',
                          medium: 'bg-blue-50 text-blue-700',
                          high: 'bg-amber-50 text-amber-700',
                          urgent: 'bg-red-50 text-red-700',
                        }
                        return (
                          <div key={`task-${task.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition group">
                            <button
                              onClick={async () => {
                                await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
                                const { data: { user: u } } = await supabase.auth.getUser()
                                if (u) {
                                  supabase.from('activity_log').insert({
                                    user_id: u.id,
                                    lead_id: task.lead_id,
                                    merchant_id: task.merchant_id,
                                    action_type: 'task_completed',
                                    description: `Task completed: ${task.title}`,
                                  })
                                }
                                setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== task.id) }))
                              }}
                              className="w-4 h-4 rounded border-2 border-slate-300 hover:border-emerald-500 shrink-0 flex items-center justify-center transition"
                              title="Mark complete"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              {task.due_date && (
                                <p className="text-xs text-slate-500">
                                  {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {task.due_time && ` at ${task.due_time}`}
                                </p>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || 'bg-slate-100 text-slate-600'}`}>
                              {task.priority}
                            </span>
                          </div>
                        )
                      })}
                      {/* Recycled lead follow-ups */}
                      {data.followUps.map((fu) => (
                        <a
                          key={`fu-${fu.id}`}
                          href={`/dashboard/leads/${fu.id}`}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition"
                        >
                          <div className="w-4 h-4 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fu.business_name}</p>
                            <p className="text-xs text-slate-500">{fu.contact_name}</p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(fu.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top 5 Merchants by Profitability */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Top 5 Merchants by Profitability</h3>
                  {data.topMerchants.length === 0 ? (
                    <p className="text-slate-400 text-xs">Import a <a href="/dashboard/residuals" className="text-emerald-600 hover:text-emerald-700">residual report</a> to see top merchants</p>
                  ) : (
                    <div>
                      {data.topMerchants.map((m, i) => (
                        <div key={m.merchantIdExternal} className={`flex items-center py-2 text-xs ${i < data.topMerchants.length - 1 ? 'border-b border-slate-50' : ''} ${i < 3 ? 'bg-emerald-50/50 rounded' : ''}`}>
                          <span className="w-6 text-slate-400 font-medium">{i + 1}</span>
                          {m.merchantId ? (
                            <a href={`/dashboard/merchants/${m.merchantId}`} className="flex-1 text-emerald-600 font-medium truncate hover:text-emerald-700">{m.dbaName}</a>
                          ) : (
                            <span className="flex-1 text-slate-700 font-medium truncate">{m.dbaName}</span>
                          )}
                          <span className={`text-right font-medium tabular-nums ${m.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {m.netProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Merchants by Processor — owner/manager only */}
                {isOwnerOrManager && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="font-semibold mb-4">Merchants by Processor</h3>
                  {data.merchantsByProcessor.length === 0 ? (
                    <p className="text-slate-400 text-sm">No merchants yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.merchantsByProcessor.map(({ processor, count }, i) => (
                        <div key={processor} className="flex items-center gap-3">
                          <span className="text-sm text-slate-500 w-28 shrink-0 truncate">{processor}</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${PROCESSOR_COLORS[i % PROCESSOR_COLORS.length]}`}
                              style={{ width: `${(count / maxProcessorCount) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600 w-8 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Residual Revenue */}
                {data.latestImport ? (
                  <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="font-semibold mb-3">Residual Revenue</h3>
                    <p className={`text-2xl font-bold ${data.residualNetRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {data.residualNetRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      From {data.latestImport.processor_name || 'Unknown processor'} — {data.latestImport.report_month || 'No month'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Total volume: {data.residualTotalVolume.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                    </p>
                    <a href="/dashboard/residuals" className="text-emerald-600 text-sm mt-3 inline-block hover:underline">
                      View Details →
                    </a>
                  </div>
                ) : (
                  <div className="bg-emerald-50/50 rounded-xl p-6 border border-dashed border-emerald-200">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <h3 className="font-semibold text-slate-700">Residual Revenue</h3>
                    </div>
                    <p className="text-slate-500 text-sm mb-4">
                      Upload your first residual report to see revenue tracking, processor breakdowns, and agent splits.
                    </p>
                    <a
                      href="/dashboard/residuals"
                      className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm transition"
                    >
                      Get Started
                    </a>
                  </div>
                )}

                {/* Merchants by Agent — owner/manager only */}
                {isOwnerOrManager && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="font-semibold mb-4">Merchants by Agent</h3>
                  {data.agentBreakdown.length === 0 ? (
                    <p className="text-slate-400 text-sm">Import a residual report to see agent breakdown</p>
                  ) : (
                    <div className="space-y-3">
                      {data.agentBreakdown.map(({ agent, merchantCount }) => (
                        <div key={agent} className="flex items-center gap-3">
                          <span className="text-sm text-slate-500 w-28 shrink-0 truncate">{agent}</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${(merchantCount / Math.max(...data.agentBreakdown.map(a => a.merchantCount), 1)) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600 w-8 text-right">{merchantCount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>

            {/* Full Width Bottom — Recent Activity */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
              {data.recentActivity.length === 0 ? (
                <p className="text-slate-400 text-xs">No recent activity</p>
              ) : (
                <div>
                  {data.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-2 py-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ACTIVITY_DOT_COLORS[activity.action_type] || 'bg-gray-500'}`}></div>
                      <p className="text-xs text-slate-600 flex-1 truncate">{activity.description}</p>
                      <span className="text-xs text-slate-400 shrink-0 ml-auto">{relativeTime(activity.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
              <a href="#" className="text-emerald-600 text-xs hover:text-emerald-700 mt-2 inline-block">View All &rarr;</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
