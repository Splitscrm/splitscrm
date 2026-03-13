'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ExportCSV from '@/components/ExportCSV'
import { useAuth } from '@/lib/auth-context'
import LoadingScreen from '@/components/LoadingScreen'

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

  // Matching modal state
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchMerchants, setMatchMerchants] = useState<any[]>([])
  const [matchSelections, setMatchSelections] = useState<Record<string, string>>({})
  const [matchingLoading, setMatchingLoading] = useState(false)
  const [applyingMatches, setApplyingMatches] = useState(false)
  const [matchMsg, setMatchMsg] = useState('')

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
      .select('id, file_name, processor_name, report_month, status, row_count, total_net, created_at')
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
    console.log('Fetching records for import:', imp.id)
    const { data, error } = await supabase
      .from('residual_records')
      .select('*')
      .eq('import_id', imp.id)
      .order('created_at')
    console.log('Records result:', data, error)
    setDetailRecords(data || [])
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

    try {
      const partnerObj = partners.find(p => p.id === selectedPartnerId)
      const pName = processorName || partnerObj?.name || undefined

      const res = await fetch('/api/map-residual-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, sampleRows, processorName: pName }),
      })

      const data = await res.json()
      if (data.error) {
        setMappingError(data.error)
        setMappingLoading(false)
        return
      }

      setMapping(data.mapping || {})
      setAiConfidence(data.confidence || 'medium')
      setAiNotes(data.notes || '')
      setHasTotalsRow(data.has_totals_row || false)
      setMultiRowPerMerchant(data.multi_row_per_merchant || false)
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

        return record
      })

      // Auto-match records to existing merchants
      const { data: userMerchants } = await supabase
        .from('merchants')
        .select('id, business_name, dba_name, mid, status')
        .eq('user_id', userId)

      if (userMerchants && userMerchants.length > 0) {
        console.log('Merchants for matching:', userMerchants.map(m => ({ id: m.id, name: m.business_name, mid: m.mid })))
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
          console.log('Matching record:', { mid: record.merchant_id_external, dba: record.dba_name, matchedTo: record.merchant_id || 'none' })
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

      // Update import with totals
      await supabase
        .from('residual_imports')
        .update({
          total_net: totalNet,
          total_revenue: totalRev,
          total_expenses: totalExp,
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
            for (const mid of toAdd) {
              console.log('Auto-populated MID:', mid, '→ merchant:', merchant.business_name)
            }
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
          console.log('Activated merchant:', merchantId, '- confirmed processing via residual import')
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

      supabase.from('user_onboarding').update({ first_residual_imported: true, updated_at: new Date().toISOString() }).eq('user_id', userId)
      setImportSuccess(true)
      setWizardStep(4)
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
    }
    setImporting(false)
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
        console.log('Activated merchant:', merchantId, '- confirmed processing via residual import')
      }

      matchedCount++
    }

    // Refresh detail records
    const { data } = await supabase
      .from('residual_records')
      .select('*')
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

  const renderSuccessStep = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-lg mx-auto text-center">
      <div className="text-5xl mb-4">✅</div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">Import Complete</h3>
      <p className="text-slate-500 mb-2">
        Successfully imported {(hasTotalsRow ? allRows.length - 1 : allRows.length).toLocaleString()} records from{' '}
        <span className="font-medium text-slate-700">{fileName}</span>
      </p>
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
            {wizardStep === 4 && renderSuccessStep()}
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
