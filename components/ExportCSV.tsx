'use client'

interface ExportColumn {
  key: string
  label: string
}

interface ExportCSVProps {
  data: any[]
  filename: string
  columns: ExportColumn[]
  buttonText?: string
}

function formatValue(val: unknown): string {
  if (val == null) return ''
  if (Array.isArray(val)) return val.join('; ')
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export default function ExportCSV({ data, filename, columns, buttonText = 'Export CSV' }: ExportCSVProps) {
  const disabled = data.length === 0

  const handleExport = () => {
    const header = columns.map(c => formatValue(c.label)).join(',')
    const rows = data.map(row =>
      columns.map(c => formatValue(row[c.key])).join(',')
    )
    const csv = [header, ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const today = new Date().toISOString().slice(0, 10)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${today}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      title={disabled ? 'No data to export' : ''}
      className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
      </svg>
      {buttonText}
    </button>
  )
}
