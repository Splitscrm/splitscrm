'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ExportCSV from '@/components/ExportCSV'
import { useAuth } from '@/lib/auth-context'
import LoadingScreen from '@/components/LoadingScreen'
import { authFetch } from '@/lib/api-client'
import { detectDataType, formatColumnValue, toDisplayName } from '@/lib/residual-columns'

const RESIDUAL_EXPORT_COLUMNS = [
  { key: 'merchant_id_external', label: 'MID' },
  { key: 'dba_name', label: 'DBA Name' },
  { key: 'fee_category', label: 'Fee Category' },
  { key: 'sales_count', label: 'Sales Count' },
  { key: 'sales_amount', label: 'Sales Amount' },
  { key: 'credit_count', label: 'Credit Count' },
  { key: 'credit_amount', label: 'Credit Amount' },
  { key: 'interchange_cost', label: 'Interchange' },
  { key: 'total_expenses', label: 'Expenses' },
  { key: 'gross_income', label: 'Income' },
  { key: 'agent_id_external', label: 'Agent Code' },
]

const STANDARDIZED_FIELDS = [
  { value: 'merchant_id_external', label: 'Merchant ID (MID)' },
  { value: 'dba_name', label: 'DBA / Business Name' },
  { value: 'sales_count', label: 'Sales Count' },
  { value: 'sales_amount', label: 'Sales Amount ($)' },
  { value: 'credit_count', label: 'Credit/Refund Count' },
  { value: 'credit_amount', label: 'Credit/Refund Amount' },
  { value: 'net_volume', label: 'Net Volume' },
  { value: 'transaction_count', label: 'Transaction Count' },
  { value: 'interchange_cost', label: 'Interchange Cost' },
  { value: 'dues_assessments', label: 'Dues & Assessments' },
  { value: 'processing_fees', label: 'Processing Fees' },
  { value: 'gross_income', label: 'Gross Income' },
  { value: 'total_expenses', label: 'Total Expenses' },
  { value: 'net_revenue', label: 'Net Revenue' },
  { value: 'agent_id_external', label: 'Agent/Rep ID' },
  { value: 'agent_split_pct', label: 'Agent Split %' },
  { value: 'agent_payout', label: 'Agent Payout' },
  { value: 'iso_net', label: 'ISO Net' },
  { value: 'report_month', label: 'Report Month' },
  { value: 'fee_category', label: 'Fee Category' },
  { value: 'description', label: 'Description' },
]

interface ImportRecord {
  id: string
  file_name: string
  processor_name: string | null
  report_month: string | null
  status: string
  row_count: number | null
  total_net: number | null
  created_at: string
  partner_id?: string | null
}

interface Partner {
  id: string
  name: string
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(current.trim())
        current = ''
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim())
        if (row.some(cell => cell !== '')) rows.push(row)
        row = []
        current = ''
        if (ch === '\r') i++
      } else {
        current += ch
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current.trim())
    if (row.some(cell => cell !== '')) rows.push(row)
  }
  return rows
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    mapping: 'bg-blue-50 text-blue-700',
    mapped: 'bg-purple-50 text-purple-700',
    imported: 'bg-emerald-50 text-emerald-700',
    error: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function ResidualsPage() {
  const router = useRouter()
  const { user: authUser, member, loading: authLoading } = useAuth()
  const role = member?.role || ''
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const [userId, setUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'wizard' | 'detail'>('list')
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loadingImports, setLoadingImports] = useState(true)

  // Detail view state
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)
  const [detailRecords, setDetailRecords] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSearch, setDetailSearch] = useState('')

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [processorName, setProcessorName] = useState('')
  const [reportMonth, setReportMonth] = useState('')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [sampleRows, setSampleRows] = useState<string[][]>([])
  const [allRows, setAllRows] = useState<string[][]>([])
  const [totalRowCount, setTotalRowCount] = useState(0)

  // Mapping state
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [aiConfidence, setAiConfidence] = useState('')
  const [aiNotes, setAiNotes] = useState('')
  const [hasTotalsRow, setHasTotalsRow] = useState(false)
  const [multiRowPerMerchant, setMultiRowPerMerchant] = useState(false)
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingError, setMappingError] = useState('')

  // Import state
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState(false)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetImport, setDeleteTargetImport] = useState<ImportRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Rep code matching state
  const [repMatchResults, setRepMatchResults] = useState<{ code: string; userId: string | null; count: number; revenue: number }[]>([])
  const [repUnmatched, setRepUnmatched] = useState<{ code: string; count: number; revenue: number; assignTo: string }[]>([])
  const [repOrgAgents, setRepOrgAgents] = useState<{ user_id: string; name: string; role: string }[]>([])
  const [repMatchSaving, setRepMatchSaving] = useState(false)
  const [lastImportId, setLastImportId] = useState<string | null>(null)
  const [repAutoMatched, setRepAutoMatched] = useState(0)
  const [repManualMatched, setRepManualMatched] = useState(0)

  // Matching modal state
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchMerchants, setMatchMerchants] = useState<any[]>([])
  const [matchSelections, setMatchSelections] = useState<Record<string, string>>({})
  const [matchingLoading, setMatchingLoading] = useState(false)
  const [applyingMatches, setApplyingMatches] = useState(false)
  const [matchMsg, setMatchMsg] = useState('')

  // Adaptive column learning state
  const [savedMappingBanner, setSavedMappingBanner] = useState('')
  const [detailColumnMappings, setDetailColumnMappings] = useState<any[]>([])
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [columnConfigTarget, setColumnConfigTarget] = useState<any>(null)
  const [columnConfigForm, setColumnConfigForm] = useState({ display_name: '', data_type: 'text', category: 'other', is_visible: true })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      fetchImports(user.id)
      fetchPartners()
    }
    init()
  }, [])

  const fetchImports = async (uid: string) => {
    setLoadingImports(true)
    const { data } = await supabase
      .from('residual_imports')
      .select('id, file_name, processor_name, report_month, status, row_count, total_net, created_at, partner_id')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setImports(data || [])
    setLoadingImports(false)
  }

  const fetchPartners = async () => {
    const { data } = await supabase
      .from('partners')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    setPartners(data || [])
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length < 2) {
      setMappingError('File must have at least a header row and one data row.')
      return
    }

    const hdrs = rows[0]
    const dataRows = rows.slice(1)
    setHeaders(hdrs)
    setSampleRows(dataRows.slice(0, 5))
    setAllRows(dataRows)
    setTotalRowCount(dataRows.length)
    setMappingError('')
    e.target.value = ''
  }

  const openDetail = async (imp: ImportRecord) => {
    setSelectedImportId(imp.id)
    setViewMode('detail')
    setDetailLoading(true)
    setDetailSearch('')
    setShowAllColumns(false)
    const { data } = await supabase
      .from('residual_records')
      .select('id, merchant_id, merchant_id_external, dba_name, fee_category, sales_amount, credit_amount, interchange_cost, total_expenses, gross_income, agent_id_external, raw_data')
      .eq('import_id', imp.id)
      .order('created_at')
    setDetailRecords(data || [])
    // Fetch learned column mappings for this partner
    if (imp.partner_id && member?.org_id) {
      const { data: colMaps } = await supabase
        .from('partner_column_mappings')
        .select('*')
        .eq('org_id', member.org_id)
        .eq('partner_id', imp.partner_id)
        .order('csv_column_name')
      setDetailColumnMappings(colMaps || [])
    } else {
      setDetailColumnMappings([])
    }
    setDetailLoading(false)
  }

  const startWizard = () => {
    setViewMode('wizard')
    setWizardStep(1)
    setSelectedPartnerId('')
    setProcessorName('')
    setReportMonth('')
    setFileName('')
    setHeaders([])
    setSampleRows([])
    setAllRows([])
    setTotalRowCount(0)
    setMapping({})
    setAiConfidence('')
    setAiNotes('')
    setHasTotalsRow(false)
    setMultiRowPerMerchant(false)
    setMappingLoading(false)
    setMappingError('')
    setImporting(false)
    setImportError('')
    setImportSuccess(false)
  }

  const goToMapping = async () => {
    setWizardStep(2)
    setMappingLoading(true)
    setMappingError('')
    setSavedMappingBanner('')

    try {
      const partnerObj = partners.find(p => p.id === selectedPartnerId)
      const pName = processorName || partnerObj?.name || undefined

      // Check for saved partner column mappings
      let savedMapping: Record<string, string | null> = {}
      let newHeaders = headers
      if (selectedPartnerId && member?.org_id) {
        const { data: saved } = await supabase
          .from('partner_column_mappings')
          .select('csv_column_name, mapped_to')
          .eq('org_id', member.org_id)
          .eq('partner_id', selectedPartnerId)
        if (saved && saved.length > 0) {
          for (const s of saved) savedMapping[s.csv_column_name] = s.mapped_to
          const knownHeaders = headers.filter(h => h in savedMapping)
          newHeaders = headers.filter(h => !(h in savedMapping))
          if (knownHeaders.length > 0) {
            setSavedMappingBanner(`Applied ${knownHeaders.length} saved column mappings for ${partnerObj?.name || "this partner"}. ${newHeaders.length > 0 ? `${newHeaders.length} new column${newHeaders.length > 1 ? "s" : ""} sent to AI.` : "All columns recognized."}`)
          }
        }
      }

      // Only AI-map columns not in saved mapping
      let aiMapping: Record<string, string | null> = {}
      if (newHeaders.length > 0) {
        const aiSampleRows = sampleRows.map(row => {
          const indices = newHeaders.map(h => headers.indexOf(h))
          return indices.map(i => row[i])
        })
        const res = await authFetch('/api/map-residual-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers: newHeaders, sampleRows: aiSampleRows, processorName: pName }),
        })
        const data = await res.json()
        if (!data.error) {
          aiMapping = data.mapping || {}
          setAiConfidence(data.confidence || 'medium')
          setAiNotes(data.notes || '')
          setHasTotalsRow(data.has_totals_row || false)
          setMultiRowPerMerchant(data.multi_row_per_merchant || false)
        } else if (Object.keys(savedMapping).length === 0) {
          setMappingError(data.error)
          setMappingLoading(false)
          return
        }
      }

      // Merge: saved mapping takes priority, AI fills new columns
      const merged: Record<string, string | null> = {}
      for (const h of headers) {
        if (h in savedMapping) merged[h] = savedMapping[h]
        else if (h in aiMapping) merged[h] = aiMapping[h]
        else merged[h] = null
      }
      setMapping(merged)
    } catch {
      setMappingError('Failed to reach AI mapping service. You can map columns manually below.')
    }
    setMappingLoading(false)
  }

  const updateMapping = (header: string, value: string) => {
    setMapping(prev => ({ ...prev, [header]: value === '' ? null : value }))
  }

  const getMappedCount = () => Object.values(mapping).filter(v => v !== null && v !== undefined).length

  const handleImport = async () => {
    if (!userId) return
    setImporting(true)
    setImportError('')

    try {
      const partnerObj = partners.find(p => p.id === selectedPartnerId)

      // Create the import record
      const { data: importRec, error: importErr } = await supabase
        .from('residual_imports')
        .insert({
          user_id: userId,
          partner_id: selectedPartnerId || null,
          file_name: fileName,
          processor_name: processorName || partnerObj?.name || null,
          report_month: reportMonth || null,
          status: 'imported',
          column_mapping: mapping,
          row_count: hasTotalsRow ? allRows.length - 1 : allRows.length,
        })
        .select('id')
        .single()

      if (importErr) throw importErr

      // Transform rows using the mapping
      const dataRows = hasTotalsRow ? allRows.slice(0, -1) : allRows
      const records = dataRows.map(row => {
        const record: Record<string, any> = {
          import_id: importRec.id,
          user_id: userId,
          report_month: reportMonth || null,
          raw_data: {} as Record<string, string>,
        }

        headers.forEach((header, idx) => {
          const value = row[idx] || ''
          ;(record.raw_data as Record<string, string>)[header] = value

          const field = mapping[header]
          if (field && field !== 'null') {
            const numericFields = [
              'sales_count', 'sales_amount', 'credit_count', 'credit_amount',
              'net_volume', 'transaction_count', 'interchange_cost', 'dues_assessments',
              'processing_fees', 'gross_income', 'total_expenses', 'net_revenue',
              'agent_split_pct', 'agent_payout', 'iso_net',
            ]
            if (numericFields.includes(field)) {
              const cleaned = value.replace(/[$,()]/g, '').trim()
              const num = parseFloat(cleaned)
              record[field] = isNaN(num) ? null : (value.includes('(') ? -num : num)
            } else {
              record[field] = value || null
            }
          }
        })

        // Calculate derived fields if not directly mapped
        const gi = record.gross_income ?? 0
        const te = record.total_expenses ?? 0
        if (record.net_revenue == null && (record.gross_income != null || record.total_expenses != null)) {
          record.net_revenue = gi - te
        }
        const sa = record.sales_amount ?? 0
        const ca = record.credit_amount ?? 0
        if (record.net_volume == null && (record.sales_amount != null || record.credit_amount != null)) {
          record.net_volume = sa - ca
        }
        if (record.iso_net == null && record.net_revenue != null) {
          const payout = record.agent_payout ?? 0
          record.iso_net = (record.net_revenue ?? 0) - payout
        }

        return record
      })

      // Auto-match records to existing merchants
      const { data: userMerchants } = await supabase
        .from('merchants')
        .select('id, business_name, dba_name, mid, status')
        .eq('user_id', userId)

      if (userMerchants && userMerchants.length > 0) {
        for (const record of records) {
          if (record.merchant_id) continue
          const midExt = record.merchant_id_external
          const dbaName = record.dba_name

          for (const m of userMerchants) {
            // Check MID match (comma-separated)
            const mids = parseMids(m.mid)
            if (midExt && mids.includes(midExt)) {
              record.merchant_id = m.id
              break
            }
            // Check DBA name match (case-insensitive partial)
            if (dbaName && m.business_name &&
                m.business_name.toLowerCase().includes(dbaName.toLowerCase())) {
              record.merchant_id = m.id
              break
            }
          }
        }
      }

      // Batch insert records (50 at a time)
      let totalNet = 0
      let totalRev = 0
      let totalExp = 0

      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50)
        const { error: recErr } = await supabase.from('residual_records').insert(batch)
        if (recErr) throw recErr

        batch.forEach(r => {
          totalNet += r.net_revenue || 0
          totalRev += r.gross_income || 0
          totalExp += r.total_expenses || 0
        })
      }

      // Update import with totals and mark completed
      await supabase
        .from('residual_imports')
        .update({
          total_net: totalNet,
          total_revenue: totalRev,
          total_expenses: totalExp,
          status: 'completed',
        })
        .eq('id', importRec.id)

      // Auto-populate MIDs on matched merchants
      if (userMerchants && userMerchants.length > 0) {
        const midUpdates = new Map<string, Set<string>>()
        for (const record of records) {
          if (record.merchant_id && record.merchant_id_external) {
            if (!midUpdates.has(record.merchant_id)) {
              midUpdates.set(record.merchant_id, new Set())
            }
            midUpdates.get(record.merchant_id)!.add(record.merchant_id_external)
          }
        }
        for (const [merchantId, newMids] of midUpdates) {
          const merchant = userMerchants.find(m => m.id === merchantId)
          if (!merchant) continue
          const existingMids = parseMids(merchant.mid)
          const toAdd = [...newMids].filter(mid => !existingMids.includes(mid))
          if (toAdd.length > 0) {
            const updatedMidStr = [...existingMids, ...toAdd].join(', ')
            await supabase.from('merchants').update({ mid: updatedMidStr }).eq('id', merchantId)
            merchant.mid = updatedMidStr

          }
        }
      }

      // Activate matched merchants that are still pending
      const matchedMerchantIds = new Set<string>()
      for (const record of records) {
        if (record.merchant_id) matchedMerchantIds.add(record.merchant_id)
      }
      for (const merchantId of matchedMerchantIds) {
        const merchant = userMerchants?.find(m => m.id === merchantId)
        if (merchant && merchant.status === 'pending') {
          await supabase.from('merchants').update({ status: 'active' }).eq('id', merchantId)
        }
      }

      // Save processor mapping for future use
      if (processorName || partnerObj?.name) {
        const { data: existingMapping } = await supabase
          .from('processor_mappings')
          .select('id')
          .eq('user_id', userId)
          .eq('processor_name', processorName || partnerObj?.name || '')
          .single()

        const mappingData = {
          user_id: userId,
          processor_name: processorName || partnerObj?.name || '',
          column_mapping: mapping,
          has_totals_row: hasTotalsRow,
          multi_row_per_merchant: multiRowPerMerchant,
          updated_at: new Date().toISOString(),
        }

        if (existingMapping) {
          await supabase.from('processor_mappings').update(mappingData).eq('id', existingMapping.id)
        } else {
          await supabase.from('processor_mappings').insert(mappingData)
        }
      }

      // ── Save learned column mappings per partner ────────────────
      if (selectedPartnerId && member?.org_id) {
        try {
          for (let hIdx = 0; hIdx < headers.length; hIdx++) {
            const csvCol = headers[hIdx]
            const mappedTo = mapping[csvCol] || null
            const sampleVals = allRows.slice(0, 50).map(row => row[hIdx] || '')
            const dataType = mappedTo && ['sales_amount', 'credit_amount', 'net_volume', 'interchange_cost', 'dues_assessments', 'processing_fees', 'gross_income', 'total_expenses', 'net_revenue', 'agent_payout', 'iso_net', 'agent_split_pct'].includes(mappedTo)
              ? 'currency' : detectDataType(sampleVals)
            const isMappedToCore = mappedTo && mappedTo !== 'null'
            // Upsert: increment seen_count, update mapped_to
            const { data: existing } = await supabase
              .from('partner_column_mappings')
              .select('id, seen_count')
              .eq('org_id', member.org_id)
              .eq('partner_id', selectedPartnerId)
              .eq('csv_column_name', csvCol)
              .maybeSingle()
            if (existing) {
              const newCount = (existing.seen_count || 0) + 1
              await supabase.from('partner_column_mappings').update({
                mapped_to: mappedTo === 'null' ? null : mappedTo,
                seen_count: newCount,
                is_visible: isMappedToCore || newCount >= 2,
                data_type: dataType,
              }).eq('id', existing.id)
            } else {
              await supabase.from('partner_column_mappings').insert({
                org_id: member.org_id,
                partner_id: selectedPartnerId,
                csv_column_name: csvCol,
                mapped_to: mappedTo === 'null' ? null : mappedTo,
                display_name: toDisplayName(csvCol),
                data_type: dataType,
                category: isMappedToCore ? 'financial' : 'other',
                is_visible: !!isMappedToCore,
                seen_count: 1,
              })
            }
          }
        } catch (colErr) {
          console.error('Column mapping save error:', colErr)
        }
      }

      supabase.from('user_onboarding').update({ first_residual_imported: true, updated_at: new Date().toISOString() }).eq('user_id', userId)
      setLastImportId(importRec.id)

      // ── Rep code auto-matching ────────────────────────────────
      // Collect unique agent codes from imported records
      const agentCodes = new Map<string, { count: number; revenue: number }>()
      for (const r of records) {
        const code = r.agent_id_external
        if (!code || typeof code !== 'string' || !code.trim()) continue
        const key = code.trim()
        const entry = agentCodes.get(key) || { count: 0, revenue: 0 }
        entry.count++
        entry.revenue += r.net_revenue || 0
        agentCodes.set(key, entry)
      }

      let autoCount = 0
      const unmatchedList: { code: string; count: number; revenue: number; assignTo: string }[] = []

      if (agentCodes.size > 0 && selectedPartnerId) {
        // Look up active rep codes for this partner
        const { data: repCodes } = await supabase
          .from('agent_rep_codes')
          .select('rep_code, user_id')
          .eq('partner_id', selectedPartnerId)
          .eq('org_id', member?.org_id)
          .eq('status', 'active')

        const repCodeMap = new Map<string, string>()
        for (const rc of repCodes || []) {
          repCodeMap.set(rc.rep_code, rc.user_id)
        }

        // Match and update records
        for (const [code, stats] of agentCodes) {
          const matchedUserId = repCodeMap.get(code)
          if (matchedUserId) {
            // Auto-match: update all records with this code
            await supabase
              .from('residual_records')
              .update({ agent_user_id: matchedUserId })
              .eq('import_id', importRec.id)
              .eq('agent_id_external', code)
            autoCount += stats.count
          } else {
            unmatchedList.push({ code, count: stats.count, revenue: stats.revenue, assignTo: '' })
          }
        }
      } else if (agentCodes.size > 0) {
        // No partner selected — all codes are unmatched
        for (const [code, stats] of agentCodes) {
          unmatchedList.push({ code, count: stats.count, revenue: stats.revenue, assignTo: '' })
        }
      }

      setRepAutoMatched(autoCount)
      setRepManualMatched(0)
      setRepUnmatched(unmatchedList)

      // Fetch org agents for assignment dropdown
      if (member?.org_id) {
        const { data: members } = await supabase
          .from('org_members')
          .select('user_id, role')
          .eq('org_id', member.org_id)
          .eq('status', 'active')
        const agents = (members || []).filter(m => ['agent', 'sub_agent', 'master_agent', 'owner', 'manager'].includes(m.role) && m.user_id)
        if (agents.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, email')
            .in('user_id', agents.map(a => a.user_id))
          const enriched = agents.map(a => {
            const p = (profiles || []).find(pr => pr.user_id === a.user_id)
            return { user_id: a.user_id, name: p?.full_name || p?.email || a.user_id.slice(0, 8), role: a.role }
          })
          setRepOrgAgents(enriched)
        }
      }

      setImportSuccess(true)
      // If there are unmatched codes, show matching step; otherwise go to success
      setWizardStep(unmatchedList.length > 0 ? 4 : 5)
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
    }
    setImporting(false)
  }

  const handleRepAssignments = async () => {
    if (!lastImportId || !member?.org_id) return
    setRepMatchSaving(true)
    let manualCount = 0

    for (const item of repUnmatched) {
      if (!item.assignTo) continue
      // Update records
      await supabase
        .from('residual_records')
        .update({ agent_user_id: item.assignTo })
        .eq('import_id', lastImportId)
        .eq('agent_id_external', item.code)

      // Create agent_rep_codes entry for future auto-matching
      if (selectedPartnerId) {
        await supabase.from('agent_rep_codes').upsert({
          org_id: member.org_id,
          user_id: item.assignTo,
          partner_id: selectedPartnerId,
          rep_code: item.code,
          status: 'active',
          effective_date: new Date().toISOString().split('T')[0],
        }, { onConflict: 'org_id, partner_id, rep_code' })
      }

      manualCount += item.count
    }

    setRepManualMatched(manualCount)
    setRepMatchSaving(false)
    setWizardStep(5)
  }

  const finishImport = () => {
    setViewMode('list')
    if (userId) fetchImports(userId)
  }

  const confirmDeleteImport = (imp: ImportRecord) => {
    setDeleteTargetImport(imp)
    setShowDeleteConfirm(true)
  }

  const handleDeleteImport = async () => {
    if (!deleteTargetImport || !userId) return
    setDeleting(true)
    await supabase.from('residual_imports').delete().eq('id', deleteTargetImport.id)
    setShowDeleteConfirm(false)
    setDeleteTargetImport(null)
    setDeleting(false)
    fetchImports(userId)
  }

  const parseMids = (midStr: string | null | undefined): string[] => {
    if (!midStr) return []
    return midStr.split(',').map(m => m.trim()).filter(Boolean)
  }

  const openMatchingModal = async () => {
    setShowMatchModal(true)
    setMatchingLoading(true)
    setMatchSelections({})
    setMatchMsg('')

    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, business_name, dba_name, mid, status')
      .eq('user_id', userId!)
      .order('business_name')

    setMatchMerchants(merchants || [])
    setMatchingLoading(false)
  }

  const applyMatches = async () => {
    if (!selectedImportId || !userId) return
    const entries = Object.entries(matchSelections).filter(([, merchantId]) => merchantId !== '')
    if (entries.length === 0) return

    setApplyingMatches(true)
    let matchedCount = 0

    for (const [midExternal, merchantId] of entries) {
      // Update all residual_records with this merchant_id_external in this import
      await supabase
        .from('residual_records')
        .update({ merchant_id: merchantId })
        .eq('import_id', selectedImportId)
        .eq('merchant_id_external', midExternal)

      // Append MID to merchant's mid field
      const merchant = matchMerchants.find(m => m.id === merchantId)
      if (merchant) {
        const existingMids = parseMids(merchant.mid)
        if (!existingMids.includes(midExternal)) {
          const newMidStr = existingMids.length > 0
            ? existingMids.join(', ') + ', ' + midExternal
            : midExternal
          await supabase.from('merchants').update({ mid: newMidStr }).eq('id', merchantId)
          // Update local state so subsequent matches see the updated MID
          merchant.mid = newMidStr
        }
      }
      // Activate merchant if pending
      if (merchant && merchant.status === 'pending') {
        await supabase.from('merchants').update({ status: 'active' }).eq('id', merchantId)
        merchant.status = 'active'
      }

      matchedCount++
    }

    // Refresh detail records
    const { data } = await supabase
      .from('residual_records')
      .select('id, merchant_id, merchant_id_external, dba_name, fee_category, sales_amount, credit_amount, interchange_cost, total_expenses, gross_income, agent_id_external')
      .eq('import_id', selectedImportId)
      .order('created_at')
    setDetailRecords(data || [])

    setShowMatchModal(false)
    setApplyingMatches(false)
    setMatchMsg(`Matched ${matchedCount} merchant${matchedCount !== 1 ? 's' : ''}`)
    setTimeout(() => setMatchMsg(''), 3000)
  }

  // --- Render ---

  const stepLabels = ['Upload', 'Map Columns', 'Review', 'Import']

  const renderStepBar = () => (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto px-2">
      {stepLabels.map((label, i) => {
        const stepNum = i + 1
        const isCompleted = wizardStep > stepNum
        const isCurrent = wizardStep === stepNum
        return (
          <div key={label} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                  isCompleted || isCurrent
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span className={`text-xs mt-1 ${isCurrent ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < stepLabels.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-12 mx-1 sm:mx-2 mb-4 ${isCompleted ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )

  const renderUploadStep = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto">
      <h3 className="font-semibold text-slate-900 mb-4">Upload Residual Report</h3>

      <div className="space-y-4">
        <div>
          <label className="text-base text-slate-500 block mb-1">Processor / Partner (optional)</label>
          <select
            value={selectedPartnerId}
            onChange={(e) => {
              setSelectedPartnerId(e.target.value)
              const p = partners.find(p => p.id === e.target.value)
              if (p) setProcessorName(p.name)
            }}
            className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Select processor (optional — helps improve AI mapping accuracy)</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {!selectedPartnerId && (
          <div>
            <label className="text-base text-slate-500 block mb-1">Or type processor name</label>
            <input
              type="text"
              value={processorName}
              onChange={(e) => setProcessorName(e.target.value)}
              className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g. Fiserv, TSYS, Worldpay"
            />
          </div>
        )}

        <div>
          <label className="text-base text-slate-500 block mb-1">Report Month</label>
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block w-full border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 bg-slate-50 transition">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            {fileName ? (
              <div>
                <p className="text-4xl mb-2">✅</p>
                <p className="text-slate-900 font-medium">{fileName}</p>
                <p className="text-emerald-600 text-sm mt-1">
                  Found {headers.length} columns and {totalRowCount} rows
                </p>
                <p className="text-slate-400 text-xs mt-2">Click to replace with a different file</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-2">📊</p>
                <p className="text-slate-600">Click to upload a residual report</p>
                <p className="text-slate-400 text-sm mt-1">Supports CSV files</p>
              </div>
            )}
          </label>
        </div>

        {mappingError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {mappingError}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-6">
        <button
          onClick={() => setViewMode('list')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-medium transition"
        >
          Cancel
        </button>
        <button
          onClick={goToMapping}
          disabled={headers.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )

  const renderMappingStep = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto">
      {savedMappingBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm mb-4">{"\u2705"} {savedMappingBanner}</div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Column Mapping</h3>
          <p className="text-base text-slate-500 mt-1">
            {getMappedCount()} of {headers.length} columns mapped
          </p>
        </div>
        {aiConfidence && (
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            aiConfidence === 'high' ? 'bg-emerald-50 text-emerald-700' :
            aiConfidence === 'medium' ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            AI Confidence: {aiConfidence}
          </span>
        )}
      </div>

      {aiNotes && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm mb-4">
          <strong>AI Notes:</strong> {aiNotes}
        </div>
      )}

      {mappingLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mb-4" />
          <p className="text-slate-600 font-medium">AI is analyzing your file format...</p>
          <p className="text-slate-400 text-sm mt-1">Matching columns to standardized fields</p>
        </div>
      ) : (
        <>
          {mappingError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">
              {mappingError}
            </div>
          )}

          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">CSV Column</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Sample Data</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Maps To</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header, idx) => (
                  <tr key={header} className="border-b border-slate-100">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{header}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-400 max-w-[200px] truncate">
                      {sampleRows[0]?.[idx] || '—'}
                    </td>
                    <td className="py-2.5">
                      <select
                        value={mapping[header] ?? ''}
                        onChange={(e) => updateMapping(header, e.target.value)}
                        className={`w-full text-xs px-2 py-1.5 rounded border ${
                          mapping[header] ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500'
                        } focus:outline-none focus:border-emerald-500`}
                      >
                        <option value="">— Ignore —</option>
                        {STANDARDIZED_FIELDS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-slate-200">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={hasTotalsRow}
                onChange={(e) => setHasTotalsRow(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              File has a totals row at the bottom
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={multiRowPerMerchant}
                onChange={(e) => setMultiRowPerMerchant(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Multiple rows per merchant (e.g. by card type)
            </label>
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mt-6">
        <button
          onClick={() => setWizardStep(1)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-medium transition"
        >
          Back
        </button>
        <button
          onClick={() => setWizardStep(3)}
          disabled={mappingLoading || getMappedCount() === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Review
        </button>
      </div>
    </div>
  )

  const renderReviewStep = () => {
    const mappedFields = Object.entries(mapping).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'null')
    const rowCount = hasTotalsRow ? allRows.length - 1 : allRows.length

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl mx-auto">
        <h3 className="font-semibold text-slate-900 mb-4">Review Import</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">File</p>
              <p className="text-slate-900 font-medium mt-1">{fileName}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Processor</p>
              <p className="text-slate-900 font-medium mt-1">{processorName || 'Not specified'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Report Month</p>
              <p className="text-slate-900 font-medium mt-1">{reportMonth || 'Not specified'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Rows to Import</p>
              <p className="text-slate-900 font-medium mt-1">{rowCount.toLocaleString()}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Mapped Fields ({mappedFields.length})
            </p>
            <div className="bg-slate-50 rounded-lg p-4 space-y-1">
              {mappedFields.map(([csvCol, field]) => {
                const label = STANDARDIZED_FIELDS.find(f => f.value === field)?.label || field
                return (
                  <div key={csvCol} className="flex items-center text-sm">
                    <span className="font-mono text-xs text-slate-500 w-1/2 truncate">{csvCol}</span>
                    <span className="text-slate-300 mx-2">→</span>
                    <span className="text-emerald-700 font-medium">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Preview first 3 rows mapped */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Data Preview (first 3 rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    {mappedFields.map(([csvCol, field]) => (
                      <th key={csvCol} className="text-left py-1.5 pr-3 text-slate-500 font-medium whitespace-nowrap">
                        {STANDARDIZED_FIELDS.find(f => f.value === field)?.label || field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.slice(0, 3).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100">
                      {mappedFields.map(([csvCol]) => {
                        const colIdx = headers.indexOf(csvCol)
                        return (
                          <td key={csvCol} className="py-1.5 pr-3 text-slate-700 whitespace-nowrap">
                            {row[colIdx] || '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {importError}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mt-6">
          <button
            onClick={() => setWizardStep(2)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-medium transition"
          >
            Back
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50"
          >
            {importing ? 'Importing...' : `Import ${(hasTotalsRow ? allRows.length - 1 : allRows.length).toLocaleString()} Records`}
          </button>
        </div>
      </div>
    )
  }

  const renderRepMatchStep = () => {
    const fmtDollar = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-bold text-slate-900 mb-1">Match Agent Rep Codes</h3>
        <p className="text-sm text-slate-500 mb-4">
          {repAutoMatched > 0 && <span className="text-emerald-600 font-medium">{repAutoMatched} records auto-matched. </span>}
          {repUnmatched.length} unrecognized rep code{repUnmatched.length !== 1 ? 's' : ''} found. Assign them to team members or skip.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-4 py-2.5 font-medium">Rep Code</th>
                <th className="px-4 py-2.5 font-medium">Records</th>
                <th className="px-4 py-2.5 font-medium">Revenue</th>
                <th className="px-4 py-2.5 font-medium">Assign To</th>
              </tr>
            </thead>
            <tbody>
              {repUnmatched.map((item, idx) => (
                <tr key={item.code} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-mono text-emerald-700 font-medium">{item.code}</td>
                  <td className="px-4 py-2.5">{item.count}</td>
                  <td className="px-4 py-2.5">{fmtDollar(item.revenue)}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={item.assignTo}
                      onChange={e => {
                        const updated = [...repUnmatched]
                        updated[idx] = { ...item, assignTo: e.target.value }
                        setRepUnmatched(updated)
                      }}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500 w-full max-w-[220px]"
                    >
                      <option value="">Skip / Unassigned</option>
                      {repOrgAgents.map(a => (
                        <option key={a.user_id} value={a.user_id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
          <button
            onClick={() => setWizardStep(5)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg text-sm font-medium transition"
          >
            Skip All
          </button>
          <button
            onClick={handleRepAssignments}
            disabled={repMatchSaving || repUnmatched.every(u => !u.assignTo)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {repMatchSaving ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    )
  }

  const renderSuccessStep = () => {
    const totalRecords = hasTotalsRow ? allRows.length - 1 : allRows.length
    const unassigned = totalRecords - repAutoMatched - repManualMatched

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-lg mx-auto text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Import Complete</h3>
        <p className="text-slate-500 mb-4">
          Successfully imported {totalRecords.toLocaleString()} records from{' '}
          <span className="font-medium text-slate-700">{fileName}</span>
        </p>

        {(repAutoMatched > 0 || repManualMatched > 0) && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm text-left">
            <p className="font-medium text-slate-700 mb-2">Agent Matching Summary</p>
            <div className="space-y-1 text-slate-600">
              {repAutoMatched > 0 && <p>Auto-matched: <span className="font-medium text-emerald-600">{repAutoMatched} records</span></p>}
              {repManualMatched > 0 && <p>Manually assigned: <span className="font-medium text-blue-600">{repManualMatched} records</span></p>}
              {unassigned > 0 && <p>Unassigned: <span className="text-slate-400">{unassigned} records</span></p>}
            </div>
            {repManualMatched > 0 && selectedPartnerId && (
              <p className="text-xs text-slate-400 mt-2">
                Newly assigned codes will auto-match on future imports from this partner.
              </p>
            )}
          </div>
        )}

        {processorName && (
          <p className="text-slate-400 text-sm mb-6">
            Column mapping saved for {processorName} — future imports will be even faster.
          </p>
        )}
        <button
          onClick={finishImport}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-medium transition"
        >
          Done
        </button>
      </div>
    )
  }

  const renderDetailView = () => {
    const imp = imports.find(i => i.id === selectedImportId)
    if (!imp) return null

    const search = detailSearch.toLowerCase()
    const filtered = search
      ? detailRecords.filter(r =>
          (r.merchant_id_external || '').toLowerCase().includes(search) ||
          (r.dba_name || '').toLowerCase().includes(search) ||
          (r.agent_id_external || '').toLowerCase().includes(search)
        )
      : detailRecords

    const totalVolume = detailRecords.reduce((s, r) => s + (r.sales_amount || 0), 0)
    const totalRevenue = detailRecords.reduce((s, r) => s + (r.gross_income || 0), 0)
    const totalExpenses = detailRecords.reduce((s, r) => s + (r.total_expenses || 0), 0)
    const netRevenue = totalRevenue - totalExpenses

    const uniqueMidExternal = new Set(detailRecords.map(r => r.merchant_id_external).filter(Boolean))
    const matchedMids = new Set(detailRecords.filter(r => r.merchant_id).map(r => r.merchant_id_external))

    const fmtDollar = (val: number) =>
      val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

    const dollarCell = (val: number | null | undefined) => {
      if (val == null) return <span className="text-slate-300">—</span>
      const negative = val < 0
      return (
        <span className={negative ? 'text-red-600' : ''} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmtDollar(val)}
        </span>
      )
    }

    return (
      <>
        <span
          onClick={() => { setViewMode('list'); setSelectedImportId(null) }}
          className="text-slate-400 hover:text-slate-900 text-sm cursor-pointer mb-4 block"
        >
          ← Back to Imports
        </span>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900">{imp.file_name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {imp.processor_name && <span className="text-base text-slate-500">{imp.processor_name}</span>}
              {imp.report_month && <span className="text-base text-slate-500">{imp.report_month}</span>}
              {imp.row_count != null && <span className="text-base text-slate-500">{imp.row_count.toLocaleString()} rows</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {matchMsg && <span className="text-emerald-600 text-sm">{matchMsg}</span>}
            {!detailLoading && detailRecords.some(r => !r.merchant_id && r.merchant_id_external) && (
              <button
                onClick={openMatchingModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Match Merchants
              </button>
            )}
            <ExportCSV
              data={detailSearch ? detailRecords.filter(r =>
                (r.merchant_id_external || '').toLowerCase().includes(detailSearch.toLowerCase()) ||
                (r.dba_name || '').toLowerCase().includes(detailSearch.toLowerCase()) ||
                (r.agent_id_external || '').toLowerCase().includes(detailSearch.toLowerCase())
              ) : detailRecords}
              filename={`residuals-${(imp.processor_name || 'unknown').replace(/\s+/g, '-')}-${imp.report_month || 'no-month'}`}
              columns={RESIDUAL_EXPORT_COLUMNS}
            />
            <StatusBadge status={imp.status} />
          </div>
        </div>

        {detailLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mb-4" />
            <p className="text-slate-500">Loading records...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-base text-slate-500">Total Volume</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{fmtDollar(totalVolume)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-base text-slate-500">Total Revenue</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{fmtDollar(totalRevenue)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-base text-slate-500">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{fmtDollar(totalExpenses)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-base text-slate-500">Net Revenue</p>
                <p className={`text-2xl font-bold mt-1 ${netRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmtDollar(netRevenue)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex gap-4 items-center">
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="Search by MID, DBA name, or agent code..."
                className="flex-1 bg-white text-slate-900 px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
              />
              <span className="text-base text-slate-500 whitespace-nowrap">
                {filtered.length} of {detailRecords.length} records
              </span>
            </div>

            {detailRecords.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                <p className="text-slate-500">No records found for this import.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase font-medium">MID</th>
                          <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase font-medium">DBA Name</th>
                          <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase font-medium">Fee Category</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase font-medium">Sales Amount</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase font-medium">Credits</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase font-medium">Interchange</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase font-medium">Expenses</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase font-medium">Income</th>
                          <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase font-medium">Agent Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((rec) => (
                          <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm">
                            <td className="px-4 py-2.5 text-slate-700 font-mono text-sm">{rec.merchant_id_external || '—'}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {rec.merchant_id ? (
                                  <Link href={`/dashboard/merchants/${rec.merchant_id}`} className="text-emerald-600 hover:underline text-base">
                                    {rec.dba_name || '—'}
                                  </Link>
                                ) : (
                                  <span className="text-slate-700 text-base">{rec.dba_name || '—'}</span>
                                )}
                                {!rec.merchant_id && rec.merchant_id_external && (
                                  <span
                                    onClick={(e) => { e.stopPropagation(); openMatchingModal() }}
                                    className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-amber-100"
                                  >
                                    Unmatched
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{rec.fee_category || '—'}</td>
                            <td className="px-4 py-2.5 text-right">{dollarCell(rec.sales_amount)}</td>
                            <td className="px-4 py-2.5 text-right">{dollarCell(rec.credit_amount)}</td>
                            <td className="px-4 py-2.5 text-right">{dollarCell(rec.interchange_cost)}</td>
                            <td className="px-4 py-2.5 text-right">{dollarCell(rec.total_expenses)}</td>
                            <td className="px-4 py-2.5 text-right">{dollarCell(rec.gross_income)}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{rec.agent_id_external || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>

                <p className="text-base text-slate-500 mt-3">
                  Matched: {matchedMids.size} of {uniqueMidExternal.size} merchants
                </p>

                {/* Additional/Learned Columns from raw_data */}
                {detailColumnMappings.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowAllColumns(!showAllColumns)}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 font-medium transition"
                    >
                      <svg className={`w-3 h-3 transition-transform ${showAllColumns ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                      Additional Fields ({detailColumnMappings.filter(c => !c.mapped_to).length} learned columns)
                    </button>
                    {showAllColumns && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase font-medium">MID</th>
                              <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase font-medium">DBA</th>
                              {detailColumnMappings.filter(c => !c.mapped_to && c.is_visible).map(col => (
                                <th key={col.id} className="text-left px-3 py-2 text-xs text-slate-500 uppercase font-medium cursor-pointer hover:text-emerald-600" onClick={() => { setColumnConfigTarget(col); setColumnConfigForm({ display_name: col.display_name, data_type: col.data_type, category: col.category, is_visible: col.is_visible }); }}>
                                  {col.display_name}
                                  <span className="text-[8px] text-slate-300 ml-1">{col.data_type === 'currency' ? '$' : col.data_type === 'boolean' ? 'Y/N' : ''}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.slice(0, 50).map((r: any) => (
                              <tr key={r.id} className="border-b border-slate-50">
                                <td className="px-3 py-1.5 text-xs text-slate-600 font-mono">{r.merchant_id_external || '\u2014'}</td>
                                <td className="px-3 py-1.5 text-xs text-slate-700">{r.dba_name || '\u2014'}</td>
                                {detailColumnMappings.filter(c => !c.mapped_to && c.is_visible).map(col => (
                                  <td key={col.id} className="px-3 py-1.5 text-xs text-slate-600">
                                    {r.raw_data ? formatColumnValue(r.raw_data[col.csv_column_name], col.data_type) : '\u2014'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filtered.length > 50 && <p className="text-xs text-slate-400 mt-1">Showing first 50 of {filtered.length} records</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Column Config Popover */}
                {columnConfigTarget && (
                  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setColumnConfigTarget(null)}>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                      <h3 className="font-semibold text-slate-900 mb-3">Configure Column</h3>
                      <p className="text-xs text-slate-400 mb-3 font-mono">{columnConfigTarget.csv_column_name}</p>
                      <div className="space-y-3">
                        <div><label className="text-xs text-slate-500 block mb-1">Display Name</label><input type="text" value={columnConfigForm.display_name} onChange={e => setColumnConfigForm(prev => ({ ...prev, display_name: e.target.value }))} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white" /></div>
                        <div><label className="text-xs text-slate-500 block mb-1">Data Type</label><select value={columnConfigForm.data_type} onChange={e => setColumnConfigForm(prev => ({ ...prev, data_type: e.target.value }))} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white"><option value="text">Text</option><option value="currency">Currency</option><option value="boolean">Boolean</option><option value="date">Date</option></select></div>
                        <div><label className="text-xs text-slate-500 block mb-1">Category</label><select value={columnConfigForm.category} onChange={e => setColumnConfigForm(prev => ({ ...prev, category: e.target.value }))} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white"><option value="financial">Financial</option><option value="agent">Agent</option><option value="merchant">Merchant</option><option value="fee">Fee</option><option value="meta">Meta</option><option value="other">Other</option></select></div>
                        <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={columnConfigForm.is_visible} onChange={e => setColumnConfigForm(prev => ({ ...prev, is_visible: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600" /><span className="text-sm text-slate-700">Visible in table</span></label></div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button onClick={async () => {
                          await supabase.from('partner_column_mappings').update(columnConfigForm).eq('id', columnConfigTarget.id)
                          setDetailColumnMappings(prev => prev.map(c => c.id === columnConfigTarget.id ? { ...c, ...columnConfigForm } : c))
                          setColumnConfigTarget(null)
                        }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Save</button>
                        <button onClick={() => setColumnConfigTarget(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </>
    )
  }

  const renderImportList = () => (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-6">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900">Residuals</h2>
          <p className="text-slate-500 text-base mt-1">Import and track residual reports from your processors</p>
        </div>
        <button
          onClick={startWizard}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
        >
          + Import Report
        </button>
      </div>

      {loadingImports ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : imports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-4xl mb-3">📊</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No residual reports yet</h3>
          <p className="text-slate-500 text-base max-w-md mx-auto mb-6">
            Upload your first residual report to get started. Our AI will automatically map columns from any processor format.
          </p>
          <button
            onClick={startWizard}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition"
          >
            Upload First Report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {imports.map(imp => (
            <div
              key={imp.id}
              onClick={() => openDetail(imp)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-slate-300 transition cursor-pointer"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{imp.file_name}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {imp.processor_name && (
                    <span className="text-base text-slate-500">{imp.processor_name}</span>
                  )}
                  {imp.report_month && (
                    <span className="text-base text-slate-400">{imp.report_month}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="text-right">
                  {imp.row_count != null && (
                    <p className="text-sm text-slate-600">{imp.row_count.toLocaleString()} rows</p>
                  )}
                  {imp.total_net != null && (
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(imp.total_net)}</p>
                  )}
                </div>
                <StatusBadge status={imp.status} />
                <button
                  onClick={(e) => { e.stopPropagation(); confirmDeleteImport(imp) }}
                  className="text-red-500 hover:text-red-400 text-xs font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (authLoading) return <LoadingScreen />

  if (!isOwnerOrManager && role !== 'agent' && role !== 'master_agent') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <Sidebar />
        <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
            <p className="text-4xl mb-4">🔒</p>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-slate-500 mb-6">You don't have access to residual data.</p>
            <Link href="/dashboard" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!isOwnerOrManager) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <Sidebar />
        <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
            <p className="text-4xl mb-4">📊</p>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Residual Data</h2>
            <p className="text-slate-500 mb-6">Your residual reports will appear here once your administrator has mapped your rep code to your account. Contact your ISO admin for access.</p>
            <Link href="/dashboard" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition inline-block">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        {viewMode === 'list' && renderImportList()}
        {viewMode === 'detail' && renderDetailView()}
        {viewMode === 'wizard' && (
          <>
            <button
              onClick={() => setViewMode('list')}
              className="text-slate-400 hover:text-slate-900 text-sm mb-6 block"
            >
              ← Back to Residuals
            </button>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-6">Import Residual Report</h2>
            {renderStepBar()}
            {wizardStep === 1 && renderUploadStep()}
            {wizardStep === 2 && renderMappingStep()}
            {wizardStep === 3 && renderReviewStep()}
            {wizardStep === 4 && renderRepMatchStep()}
            {wizardStep === 5 && renderSuccessStep()}
          </>
        )}
      </div>

      {showMatchModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900">Match Merchants</h3>
            <p className="text-base text-slate-500 mt-1 mb-4">
              Link residual records to your existing merchants. A single merchant can have multiple MIDs.
            </p>

            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm p-3 rounded-lg mb-4">
              Multiple MIDs from the same business? Select the same merchant for each — all MIDs will be saved to that merchant's profile.
            </div>

            {matchingLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mb-4" />
                <p className="text-slate-500">Loading merchants...</p>
              </div>
            ) : (() => {
              const unmatchedMap = new Map<string, string>()
              for (const r of detailRecords) {
                if (!r.merchant_id && r.merchant_id_external && !unmatchedMap.has(r.merchant_id_external)) {
                  unmatchedMap.set(r.merchant_id_external, r.dba_name || '')
                }
              }
              const unmatchedEntries = Array.from(unmatchedMap.entries())

              if (unmatchedEntries.length === 0) {
                return <p className="text-slate-500 text-base py-4">All records are already matched.</p>
              }

              return (
                <div>
                  {unmatchedEntries.map(([midExt, dbaName]) => {
                    const dbaLower = (dbaName || '').toLowerCase()

                    // Build sorted merchant options with suggestions first
                    const midMatches: any[] = []
                    const nameMatches: any[] = []
                    const others: any[] = []

                    for (const m of matchMerchants) {
                      const mids = parseMids(m.mid)
                      const midLabel = mids.length > 0 ? ` (${mids.join(', ')})` : ''
                      const displayName = (m.business_name || 'Unnamed') + midLabel

                      if (mids.includes(midExt)) {
                        midMatches.push({ id: m.id, label: `\u2B50 MID Match: ${displayName}` })
                      } else if (dbaLower && m.business_name && m.business_name.toLowerCase().includes(dbaLower)) {
                        nameMatches.push({ id: m.id, label: `\u2B50 ${displayName}` })
                      } else {
                        others.push({ id: m.id, label: displayName })
                      }
                    }

                    const options = [...midMatches, ...nameMatches, ...others]

                    return (
                      <div key={midExt} className="border-b border-slate-100 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-slate-900">{midExt}</p>
                          {dbaName && <p className="text-base text-slate-500 truncate">{dbaName}</p>}
                        </div>
                        <select
                          value={matchSelections[midExt] || ''}
                          onChange={(e) => setMatchSelections(prev => ({ ...prev, [midExt]: e.target.value }))}
                          className="w-full sm:w-72 shrink-0 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">— Select Merchant —</option>
                          {options.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                          <option value="" disabled>───────────</option>
                          <option value="">➕ Skip (don't match)</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowMatchModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={applyMatches}
                disabled={applyingMatches || Object.values(matchSelections).filter(v => v !== '').length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {applyingMatches ? 'Applying...' : 'Apply Matches'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteTargetImport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900">Delete Import?</h3>
            <p className="text-base text-slate-500 mt-2">
              This will permanently delete this import and all {deleteTargetImport.row_count?.toLocaleString() ?? 0} residual records. This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTargetImport(null) }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteImport}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
