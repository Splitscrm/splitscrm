'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────

interface ResidualRecord {
  report_month: string
  gross_income: number
  total_expenses: number
  net_revenue: number
  sales_amount: number
  merchant_id: string | null
  merchant_id_external: string | null
  dba_name: string | null
  import_id: string
}

interface ImportRow {
  id: string
  partner_id: string | null
  report_month: string
  processor_name: string | null
}

interface Partner {
  id: string
  name: string
  residual_split: number | null
}

interface MonthData {
  month: string
  revenue: number
  [partnerKey: string]: string | number
}

interface MerchantAnomaly {
  merchantName: string
  partnerName: string
  lastMonth: number
  thisMonth: number
  changePct: number
  type: 'drop' | 'zero' | 'new'
}

interface PartnerProfit {
  partnerId: string
  partnerName: string
  activeMerchants: number
  totalRevenue: number
  avgPerMerchant: number
  splitPct: number
  splitCost: number
  isoNet: number
  totalVolume: number
  effectiveBps: number
  merchantCounts: number[] // last 3 months
  expanded: boolean
  merchants: { name: string; mid: string; revenue: number; volume: number }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 0
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtPct = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

const monthLabel = (m: string) => {
  if (!m) return ''
  const d = new Date(m + '-01')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

// ── Component ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  const { user, member, hasPermission, loading: authLoading } = useAuth()
  const isOwnerOrManager = member?.role === 'owner' || member?.role === 'manager'

  const [tab, setTab] = useState<'trending' | 'profitability'>('trending')
  const [loading, setLoading] = useState(true)

  // Raw data
  const [records, setRecords] = useState<ResidualRecord[]>([])
  const [imports, setImports] = useState<ImportRow[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [merchants, setMerchants] = useState<{ id: string; business_name: string; mid: string; monthly_volume: number; processor: string; status: string; user_id: string }[]>([])

  // ── Fetch data ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    const load = async () => {
      setLoading(true)
      const uid = user.id

      // Fetch imports
      let importsQuery = supabase
        .from('residual_imports')
        .select('id, partner_id, report_month, processor_name')
        .eq('status', 'completed')
        .order('report_month', { ascending: true })
      if (!isOwnerOrManager) importsQuery = importsQuery.eq('user_id', uid)
      const { data: impData } = await importsQuery
      setImports(impData || [])

      if (!impData || impData.length === 0) {
        setLoading(false)
        return
      }

      // Fetch all records for those imports
      const importIds = impData.map(i => i.id)
      const allRecords: ResidualRecord[] = []
      // Batch in groups of 20 to avoid URL length limits
      for (let i = 0; i < importIds.length; i += 20) {
        const batch = importIds.slice(i, i + 20)
        const { data: recData } = await supabase
          .from('residual_records')
          .select('report_month, gross_income, total_expenses, net_revenue, sales_amount, merchant_id, merchant_id_external, dba_name, import_id')
          .in('import_id', batch)
        if (recData) allRecords.push(...recData)
      }
      setRecords(allRecords)

      // Fetch partners
      const { data: partnerData } = await supabase
        .from('partners')
        .select('id, name, residual_split')
        .order('name')
      setPartners(partnerData || [])

      // Fetch merchants
      let merchantQuery = supabase
        .from('merchants')
        .select('id, business_name, mid, monthly_volume, processor, status, user_id')
      if (!isOwnerOrManager) merchantQuery = merchantQuery.or(`user_id.eq.${uid},assigned_to.eq.${uid}`)
      const { data: merchData } = await merchantQuery
      setMerchants(merchData || [])

      setLoading(false)
    }
    load()
  }, [authLoading, user, isOwnerOrManager, router])

  // ── Derived: import → partner mapping ──────────────────────────────────

  const importPartnerMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const imp of imports) {
      if (imp.partner_id) m[imp.id] = imp.partner_id
    }
    return m
  }, [imports])

  const partnerMap = useMemo(() => {
    const m: Record<string, Partner> = {}
    for (const p of partners) m[p.id] = p
    return m
  }, [partners])

  // ── Derived: sorted months ─────────────────────────────────────────────

  const sortedMonths = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) if (r.report_month) set.add(r.report_month)
    return Array.from(set).sort()
  }, [records])

  const latestMonth = sortedMonths[sortedMonths.length - 1] || ''
  const prevMonth = sortedMonths[sortedMonths.length - 2] || ''

  // ── Tab 1: Trending computations ───────────────────────────────────────

  const monthlyTotals = useMemo(() => {
    const map: Record<string, { revenue: number; merchants: Set<string> }> = {}
    for (const r of records) {
      const m = r.report_month
      if (!m) continue
      if (!map[m]) map[m] = { revenue: 0, merchants: new Set() }
      map[m].revenue += r.net_revenue || 0
      if (r.merchant_id || r.merchant_id_external) {
        map[m].merchants.add(r.merchant_id || r.merchant_id_external || '')
      }
    }
    return map
  }, [records])

  const currentRevenue = monthlyTotals[latestMonth]?.revenue || 0
  const prevRevenue = monthlyTotals[prevMonth]?.revenue || 0
  const momChange = currentRevenue - prevRevenue
  const momPct = prevRevenue !== 0 ? (momChange / prevRevenue) * 100 : 0
  const activeMerchantCount = monthlyTotals[latestMonth]?.merchants.size || 0

  const threeMonthAvg = useMemo(() => {
    const last3 = sortedMonths.slice(-3)
    if (last3.length === 0) return 0
    const sum = last3.reduce((s, m) => s + (monthlyTotals[m]?.revenue || 0), 0)
    return sum / last3.length
  }, [sortedMonths, monthlyTotals])

  // Chart data: revenue by month
  const chartData = useMemo(() => {
    return sortedMonths.map(m => ({
      month: monthLabel(m),
      revenue: Math.round((monthlyTotals[m]?.revenue || 0) * 100) / 100,
    }))
  }, [sortedMonths, monthlyTotals])

  // ── By-partner breakdown ───────────────────────────────────────────────

  const partnerMonthlyData = useMemo(() => {
    // partner_id → month → revenue
    const map: Record<string, Record<string, number>> = {}
    const noPartner = '_none'

    for (const r of records) {
      const m = r.report_month
      if (!m) continue
      const pid = importPartnerMap[r.import_id] || noPartner
      if (!map[pid]) map[pid] = {}
      map[pid][m] = (map[pid][m] || 0) + (r.net_revenue || 0)
    }
    return map
  }, [records, importPartnerMap])

  const partnerIds = useMemo(() =>
    Object.keys(partnerMonthlyData).filter(id => id !== '_none').sort()
  , [partnerMonthlyData])

  const multiSeriesChart = useMemo((): MonthData[] => {
    return sortedMonths.map(m => {
      const row: MonthData = { month: monthLabel(m), revenue: 0 }
      for (const pid of partnerIds) {
        const pName = partnerMap[pid]?.name || pid.slice(0, 8)
        row[pName] = Math.round((partnerMonthlyData[pid]?.[m] || 0) * 100) / 100
      }
      // add "Other" for records without partner
      if (partnerMonthlyData['_none']) {
        row['Other'] = Math.round((partnerMonthlyData['_none']?.[m] || 0) * 100) / 100
      }
      return row
    })
  }, [sortedMonths, partnerIds, partnerMonthlyData, partnerMap])

  const partnerSeriesNames = useMemo(() => {
    const names = partnerIds.map(pid => partnerMap[pid]?.name || pid.slice(0, 8))
    if (partnerMonthlyData['_none']) names.push('Other')
    return names
  }, [partnerIds, partnerMap, partnerMonthlyData])

  // Partner table
  const partnerTableRows = useMemo(() => {
    const allPids = [...partnerIds]
    if (partnerMonthlyData['_none']) allPids.push('_none')
    return allPids.map(pid => {
      const name = pid === '_none' ? 'Other / Unassigned' : (partnerMap[pid]?.name || 'Unknown')
      const thisMonth = partnerMonthlyData[pid]?.[latestMonth] || 0
      const lastMonth = partnerMonthlyData[pid]?.[prevMonth] || 0
      const delta = thisMonth - lastMonth
      const changePct = lastMonth !== 0 ? (delta / lastMonth) * 100 : 0
      const last3 = sortedMonths.slice(-3)
      const avg3 = last3.length > 0
        ? last3.reduce((s, m) => s + (partnerMonthlyData[pid]?.[m] || 0), 0) / last3.length
        : 0
      return { pid, name, thisMonth, lastMonth, delta, changePct, avg3 }
    })
  }, [partnerIds, partnerMonthlyData, partnerMap, latestMonth, prevMonth, sortedMonths])

  const [partnerSortCol, setPartnerSortCol] = useState<string>('thisMonth')
  const [partnerSortAsc, setPartnerSortAsc] = useState(false)

  const sortedPartnerTable = useMemo(() => {
    const rows = [...partnerTableRows]
    rows.sort((a, b) => {
      const aVal = (a as any)[partnerSortCol]
      const bVal = (b as any)[partnerSortCol]
      if (typeof aVal === 'string') return partnerSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return partnerSortAsc ? aVal - bVal : bVal - aVal
    })
    return rows
  }, [partnerTableRows, partnerSortCol, partnerSortAsc])

  const togglePartnerSort = (col: string) => {
    if (partnerSortCol === col) setPartnerSortAsc(!partnerSortAsc)
    else { setPartnerSortCol(col); setPartnerSortAsc(false) }
  }

  // ── Anomaly detection ──────────────────────────────────────────────────

  const anomalies = useMemo((): MerchantAnomaly[] => {
    if (!latestMonth || !prevMonth) return []

    // Group records by merchant + month
    const byMerchant: Record<string, Record<string, { revenue: number; name: string; importId: string }>> = {}
    for (const r of records) {
      const key = r.merchant_id || r.merchant_id_external || r.dba_name || 'unknown'
      if (!byMerchant[key]) byMerchant[key] = {}
      if (!byMerchant[key][r.report_month]) {
        byMerchant[key][r.report_month] = { revenue: 0, name: r.dba_name || key, importId: r.import_id }
      }
      byMerchant[key][r.report_month].revenue += r.net_revenue || 0
    }

    const results: MerchantAnomaly[] = []
    for (const [key, months] of Object.entries(byMerchant)) {
      const curr = months[latestMonth]
      const prev = months[prevMonth]
      const importId = curr?.importId || prev?.importId || ''
      const pid = importPartnerMap[importId]
      const pName = pid ? (partnerMap[pid]?.name || 'Unknown') : 'Other'
      const mName = curr?.name || prev?.name || key

      if (prev && !curr) {
        // Had residual last month, zero this month
        results.push({ merchantName: mName, partnerName: pName, lastMonth: prev.revenue, thisMonth: 0, changePct: -100, type: 'zero' })
      } else if (!prev && curr) {
        // New merchant
        results.push({ merchantName: mName, partnerName: pName, lastMonth: 0, thisMonth: curr.revenue, changePct: 100, type: 'new' })
      } else if (prev && curr) {
        const pct = prev.revenue !== 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : 0
        if (pct <= -20) {
          results.push({ merchantName: mName, partnerName: pName, lastMonth: prev.revenue, thisMonth: curr.revenue, changePct: pct, type: 'drop' })
        }
      }
    }

    results.sort((a, b) => a.changePct - b.changePct)
    return results
  }, [records, latestMonth, prevMonth, importPartnerMap, partnerMap])

  // ── Tab 2: Partner Profitability ───────────────────────────────────────

  const partnerProfitData = useMemo((): PartnerProfit[] => {
    // For each partner: count merchants, sum revenue, compute split
    const allPids = [...partnerIds]
    if (partnerMonthlyData['_none']) allPids.push('_none')

    // merchant → partner mapping via import
    const merchantPartner: Record<string, string> = {}
    for (const r of records) {
      if (r.report_month !== latestMonth) continue
      const mid = r.merchant_id || r.merchant_id_external || ''
      if (!mid) continue
      const pid = importPartnerMap[r.import_id] || '_none'
      merchantPartner[mid] = pid
    }

    // revenue + volume per partner per merchant for latest month
    const partnerMerchants: Record<string, Record<string, { name: string; mid: string; revenue: number; volume: number }>> = {}
    for (const r of records) {
      if (r.report_month !== latestMonth) continue
      const mid = r.merchant_id || r.merchant_id_external || ''
      if (!mid) continue
      const pid = merchantPartner[mid] || '_none'
      if (!partnerMerchants[pid]) partnerMerchants[pid] = {}
      if (!partnerMerchants[pid][mid]) {
        partnerMerchants[pid][mid] = { name: r.dba_name || mid, mid: r.merchant_id_external || mid, revenue: 0, volume: 0 }
      }
      partnerMerchants[pid][mid].revenue += r.net_revenue || 0
      partnerMerchants[pid][mid].volume += r.sales_amount || 0
    }

    // Merchant count per partner per month (for trend)
    const merchantCountByMonth: Record<string, Record<string, Set<string>>> = {}
    for (const r of records) {
      const pid = importPartnerMap[r.import_id] || '_none'
      const mid = r.merchant_id || r.merchant_id_external || ''
      if (!mid) continue
      if (!merchantCountByMonth[pid]) merchantCountByMonth[pid] = {}
      if (!merchantCountByMonth[pid][r.report_month]) merchantCountByMonth[pid][r.report_month] = new Set()
      merchantCountByMonth[pid][r.report_month].add(mid)
    }

    return allPids.map(pid => {
      const pName = pid === '_none' ? 'Other / Unassigned' : (partnerMap[pid]?.name || 'Unknown')
      const splitPct = pid !== '_none' ? (partnerMap[pid]?.residual_split || 0) : 0
      const mList = Object.values(partnerMerchants[pid] || {})
      const totalRevenue = mList.reduce((s, m) => s + m.revenue, 0)
      const totalVolume = mList.reduce((s, m) => s + m.volume, 0)
      const splitCost = totalRevenue * (splitPct / 100)
      const isoNet = totalRevenue - splitCost
      const effectiveBps = totalVolume > 0 ? (isoNet / totalVolume) * 10000 : 0
      const last3 = sortedMonths.slice(-3)
      const merchantCounts = last3.map(m => merchantCountByMonth[pid]?.[m]?.size || 0)

      return {
        partnerId: pid,
        partnerName: pName,
        activeMerchants: mList.length,
        totalRevenue,
        avgPerMerchant: mList.length > 0 ? totalRevenue / mList.length : 0,
        splitPct,
        splitCost,
        isoNet,
        totalVolume,
        effectiveBps,
        merchantCounts,
        expanded: false,
        merchants: mList.sort((a, b) => b.revenue - a.revenue),
      }
    })
  }, [partnerIds, partnerMonthlyData, records, latestMonth, importPartnerMap, partnerMap, sortedMonths])

  const [profitSortCol, setProfitSortCol] = useState<string>('isoNet')
  const [profitSortAsc, setProfitSortAsc] = useState(false)
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set())

  const sortedProfitTable = useMemo(() => {
    const rows = [...partnerProfitData]
    rows.sort((a, b) => {
      const aVal = (a as any)[profitSortCol]
      const bVal = (b as any)[profitSortCol]
      if (typeof aVal === 'string') return profitSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return profitSortAsc ? aVal - bVal : bVal - aVal
    })
    return rows
  }, [partnerProfitData, profitSortCol, profitSortAsc])

  const toggleProfitSort = (col: string) => {
    if (profitSortCol === col) setProfitSortAsc(!profitSortAsc)
    else { setProfitSortCol(col); setProfitSortAsc(false) }
  }

  const toggleExpand = (pid: string) => {
    setExpandedPartners(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  // ── Sort arrow helper ──────────────────────────────────────────────────

  const SortArrow = ({ col, current, asc }: { col: string; current: string; asc: boolean }) => {
    if (col !== current) return <span className="text-slate-300 ml-1">&#8597;</span>
    return <span className="text-emerald-500 ml-1">{asc ? '&#9650;' : '&#9660;'}</span>
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (authLoading) return null

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />
      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
            <button
              onClick={() => setTab('trending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'trending' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Residual Trending
            </button>
            <button
              onClick={() => setTab('profitability')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'profitability' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Partner Profitability
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p className="text-slate-500">No residual data available yet.</p>
            <p className="text-sm text-slate-400 mt-1">Import residual files from the Residuals page to see reports.</p>
          </div>
        ) : tab === 'trending' ? (
          /* ═══════════ TAB 1: RESIDUAL TRENDING ═══════════ */
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm text-slate-500 mb-1">Total Residual This Month</p>
                <p className="text-2xl font-semibold">{fmt(currentRevenue)}</p>
                {latestMonth && <p className="text-xs text-slate-400 mt-1">{monthLabel(latestMonth)}</p>}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm text-slate-500 mb-1">Month-over-Month</p>
                <p className={`text-2xl font-semibold ${momChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmt(momChange)}
                </p>
                <p className={`text-sm mt-1 ${momChange >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {fmtPct(momPct)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm text-slate-500 mb-1">3-Month Average</p>
                <p className="text-2xl font-semibold">{fmt(threeMonthAvg)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm text-slate-500 mb-1">Active Merchants</p>
                <p className="text-2xl font-semibold">{activeMerchantCount}</p>
                <p className="text-xs text-slate-400 mt-1">with residuals this month</p>
              </div>
            </div>

            {/* Revenue trend chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Residual Revenue Trend</h2>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Net Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                  Need at least 2 months of data for a trend chart.
                </div>
              )}
            </div>

            {/* By-partner chart */}
            {partnerSeriesNames.length > 0 && multiSeriesChart.length > 1 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Revenue by Partner</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={multiSeriesChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Legend />
                    {partnerSeriesNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Partner breakdown table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 pb-3">
                <h2 className="text-lg font-semibold">Partner Breakdown</h2>
              </div>
              {partnerTableRows.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-slate-400">No partner data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-slate-100 text-left text-slate-500">
                        {[
                          { key: 'name', label: 'Partner' },
                          { key: 'thisMonth', label: 'This Month' },
                          { key: 'lastMonth', label: 'Last Month' },
                          { key: 'delta', label: 'Delta' },
                          { key: 'changePct', label: 'Change' },
                          { key: 'avg3', label: '3-Mo Avg' },
                        ].map(col => (
                          <th key={col.key} className="px-6 py-3 font-medium cursor-pointer hover:text-slate-900 whitespace-nowrap" onClick={() => togglePartnerSort(col.key)}>
                            {col.label}
                            <SortArrow col={col.key} current={partnerSortCol} asc={partnerSortAsc} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPartnerTable.map(row => (
                        <tr key={row.pid} className={`border-t border-slate-100 hover:bg-slate-50 ${row.changePct <= -10 ? 'bg-red-50' : ''}`}>
                          <td className="px-6 py-3 font-medium">{row.name}</td>
                          <td className="px-6 py-3">{fmt(row.thisMonth)}</td>
                          <td className="px-6 py-3">{fmt(row.lastMonth)}</td>
                          <td className={`px-6 py-3 ${row.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(row.delta)}</td>
                          <td className={`px-6 py-3 ${row.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtPct(row.changePct)}</td>
                          <td className="px-6 py-3">{fmt(row.avg3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Anomaly detection */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Anomaly Detection</h2>
              {anomalies.length === 0 ? (
                <p className="text-sm text-slate-400">No anomalies detected this month.</p>
              ) : (
                <div className="space-y-2">
                  {anomalies.map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        {a.type === 'drop' && <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Drop</span>}
                        {a.type === 'zero' && <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Zero</span>}
                        {a.type === 'new' && <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">New</span>}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.merchantName}</p>
                          <p className="text-xs text-slate-400">{a.partnerName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right shrink-0 ml-4">
                        <div>
                          <p className="text-xs text-slate-400">Last Month</p>
                          <p className="text-sm">{fmt(a.lastMonth)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">This Month</p>
                          <p className="text-sm">{fmt(a.thisMonth)}</p>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${a.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmtPct(a.changePct)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ═══════════ TAB 2: PARTNER PROFITABILITY ═══════════ */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 pb-3">
              <h2 className="text-lg font-semibold">Partner Profitability</h2>
              {latestMonth && <p className="text-sm text-slate-400 mt-1">Data for {monthLabel(latestMonth)}</p>}
            </div>
            {sortedProfitTable.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-slate-400">No partner profitability data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-slate-100 text-left text-slate-500">
                      {[
                        { key: 'partnerName', label: 'Partner' },
                        { key: 'activeMerchants', label: 'Merchants' },
                        { key: 'totalRevenue', label: 'Revenue' },
                        { key: 'avgPerMerchant', label: 'Avg / Merchant' },
                        { key: 'splitPct', label: 'Split %' },
                        { key: 'splitCost', label: 'Split Cost' },
                        { key: 'isoNet', label: 'ISO Net' },
                        { key: 'totalVolume', label: 'Volume' },
                        { key: 'effectiveBps', label: 'Eff. BPS' },
                      ].map(col => (
                        <th key={col.key} className="px-4 py-3 font-medium cursor-pointer hover:text-slate-900 whitespace-nowrap" onClick={() => toggleProfitSort(col.key)}>
                          {col.label}
                          <SortArrow col={col.key} current={profitSortCol} asc={profitSortAsc} />
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProfitTable.map(row => (
                      <>
                        <tr
                          key={row.partnerId}
                          className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleExpand(row.partnerId)}
                        >
                          <td className="px-4 py-3 font-medium">
                            <span className="mr-1.5 text-slate-400">{expandedPartners.has(row.partnerId) ? '&#9660;' : '&#9654;'}</span>
                            {row.partnerName}
                          </td>
                          <td className="px-4 py-3">{row.activeMerchants}</td>
                          <td className="px-4 py-3">{fmt(row.totalRevenue)}</td>
                          <td className="px-4 py-3">{fmt(row.avgPerMerchant)}</td>
                          <td className="px-4 py-3">{row.splitPct > 0 ? `${row.splitPct}%` : '-'}</td>
                          <td className="px-4 py-3">{row.splitCost > 0 ? fmt(row.splitCost) : '-'}</td>
                          <td className="px-4 py-3 font-medium text-emerald-600">{fmt(row.isoNet)}</td>
                          <td className="px-4 py-3">{row.totalVolume > 0 ? `$${(row.totalVolume / 1000).toFixed(0)}k` : '-'}</td>
                          <td className="px-4 py-3">{row.effectiveBps > 0 ? row.effectiveBps.toFixed(1) : '-'}</td>
                          <td className="px-4 py-3">
                            {/* Mini sparkline / trend indicator */}
                            {row.merchantCounts.length >= 2 ? (
                              <div className="flex items-center gap-1">
                                {row.merchantCounts.map((c, i) => (
                                  <div key={i} className="w-5 h-5 flex items-center justify-center text-xs text-slate-500">
                                    {c}
                                  </div>
                                ))}
                                {row.merchantCounts[row.merchantCounts.length - 1] > row.merchantCounts[0] ? (
                                  <span className="text-emerald-500 text-xs ml-1">&#9650;</span>
                                ) : row.merchantCounts[row.merchantCounts.length - 1] < row.merchantCounts[0] ? (
                                  <span className="text-red-500 text-xs ml-1">&#9660;</span>
                                ) : (
                                  <span className="text-slate-400 text-xs ml-1">&#8212;</span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                        {expandedPartners.has(row.partnerId) && row.merchants.length > 0 && (
                          <tr key={`${row.partnerId}-detail`} className="border-t border-slate-50">
                            <td colSpan={10} className="px-4 py-0">
                              <div className="py-3 pl-8">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-slate-400">
                                      <th className="pb-2 font-medium">Merchant</th>
                                      <th className="pb-2 font-medium">MID</th>
                                      <th className="pb-2 font-medium">Revenue</th>
                                      <th className="pb-2 font-medium">Volume</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.merchants.map((m, i) => (
                                      <tr key={i} className="border-t border-slate-50">
                                        <td className="py-1.5">{m.name}</td>
                                        <td className="py-1.5 text-slate-500">{m.mid}</td>
                                        <td className="py-1.5">{fmt(m.revenue)}</td>
                                        <td className="py-1.5">{m.volume > 0 ? `$${(m.volume / 1000).toFixed(0)}k` : '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
