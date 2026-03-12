'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default function AddMerchantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showFullFees, setShowFullFees] = useState(false)
  const [form, setForm] = useState({
    business_name: '',
    dba_name: '',
    business_street: '',
    business_city: '',
    business_state: '',
    business_zip: '',
    contact_name: '',
    email: '',
    phone: '',
    mid: '',
    processor: '',
    status: 'pending',
    notes: '',
    pricing_type: '',
    pricing_rate: '',
    per_transaction_fee: '',
    monthly_fees: '',
    ic_plus_visa_pct: '',
    ic_plus_mc_pct: '',
    ic_plus_amex_pct: '',
    ic_plus_disc_pct: '',
    ic_plus_visa_txn: '',
    ic_plus_mc_txn: '',
    ic_plus_amex_txn: '',
    ic_plus_disc_txn: '',
    dual_pricing_rate: '',
    dual_pricing_txn_fee: '',
    flat_rate_pct: '',
    flat_rate_txn_cost: '',
    fee_chargeback: '',
    fee_retrieval: '',
    fee_arbitration: '',
    fee_voice_auth: '',
    fee_ebt_auth: '',
    fee_gateway_monthly: '',
    fee_gateway_txn: '',
    fee_ach_reject: '',
    monthly_fee_statement: '',
    monthly_fee_custom_name: '',
    monthly_fee_custom_amount: '',
    pci_compliance_monthly: '',
    pci_compliance_annual: '',
    interchange_remittance: '',
    boarding_date: '',
    contract_length_months: '',
    contract_end_date: '',
    terminal_type: '',
    terminal_serial: '',
    equipment_cost: '',
    free_equipment: '',
    monthly_volume: '',
    last_month_residual: '',
    average_residual: '',
    chargeback_count: '',
    chargeback_volume: '',
    chargeback_ratio: '',
  })

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.business_name.trim()) {
      setError('Business name is required')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: insertError } = await supabase.from('merchants').insert({
      user_id: user.id,
      business_name: form.business_name,
      dba_name: form.dba_name || null,
      business_street: form.business_street || null,
      business_city: form.business_city || null,
      business_state: form.business_state || null,
      business_zip: form.business_zip || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      mid: form.mid || null,
      processor: form.processor || null,
      status: form.status,
      notes: form.notes || null,
      pricing_type: form.pricing_type || null,
      pricing_rate: form.pricing_rate ? parseFloat(form.pricing_rate) : null,
      per_transaction_fee: form.per_transaction_fee ? parseFloat(form.per_transaction_fee) : null,
      monthly_fees: form.monthly_fees ? parseFloat(form.monthly_fees) : null,
      ic_plus_visa_pct: form.ic_plus_visa_pct ? parseFloat(form.ic_plus_visa_pct) : null,
      ic_plus_mc_pct: form.ic_plus_mc_pct ? parseFloat(form.ic_plus_mc_pct) : null,
      ic_plus_amex_pct: form.ic_plus_amex_pct ? parseFloat(form.ic_plus_amex_pct) : null,
      ic_plus_disc_pct: form.ic_plus_disc_pct ? parseFloat(form.ic_plus_disc_pct) : null,
      ic_plus_visa_txn: form.ic_plus_visa_txn ? parseFloat(form.ic_plus_visa_txn) : null,
      ic_plus_mc_txn: form.ic_plus_mc_txn ? parseFloat(form.ic_plus_mc_txn) : null,
      ic_plus_amex_txn: form.ic_plus_amex_txn ? parseFloat(form.ic_plus_amex_txn) : null,
      ic_plus_disc_txn: form.ic_plus_disc_txn ? parseFloat(form.ic_plus_disc_txn) : null,
      dual_pricing_rate: form.dual_pricing_rate ? parseFloat(form.dual_pricing_rate) : null,
      dual_pricing_txn_fee: form.dual_pricing_txn_fee ? parseFloat(form.dual_pricing_txn_fee) : null,
      flat_rate_pct: form.flat_rate_pct ? parseFloat(form.flat_rate_pct) : null,
      flat_rate_txn_cost: form.flat_rate_txn_cost ? parseFloat(form.flat_rate_txn_cost) : null,
      fee_chargeback: form.fee_chargeback ? parseFloat(form.fee_chargeback) : null,
      fee_retrieval: form.fee_retrieval ? parseFloat(form.fee_retrieval) : null,
      fee_arbitration: form.fee_arbitration ? parseFloat(form.fee_arbitration) : null,
      fee_voice_auth: form.fee_voice_auth ? parseFloat(form.fee_voice_auth) : null,
      fee_ebt_auth: form.fee_ebt_auth ? parseFloat(form.fee_ebt_auth) : null,
      fee_gateway_monthly: form.fee_gateway_monthly ? parseFloat(form.fee_gateway_monthly) : null,
      fee_gateway_txn: form.fee_gateway_txn ? parseFloat(form.fee_gateway_txn) : null,
      fee_ach_reject: form.fee_ach_reject ? parseFloat(form.fee_ach_reject) : null,
      monthly_fee_statement: form.monthly_fee_statement ? parseFloat(form.monthly_fee_statement) : null,
      monthly_fee_custom_name: form.monthly_fee_custom_name || null,
      monthly_fee_custom_amount: form.monthly_fee_custom_amount ? parseFloat(form.monthly_fee_custom_amount) : null,
      pci_compliance_monthly: form.pci_compliance_monthly ? parseFloat(form.pci_compliance_monthly) : null,
      pci_compliance_annual: form.pci_compliance_annual ? parseFloat(form.pci_compliance_annual) : null,
      interchange_remittance: form.interchange_remittance || null,
      boarding_date: form.boarding_date || null,
      contract_length_months: form.contract_length_months ? parseInt(form.contract_length_months) : null,
      contract_end_date: form.contract_end_date || null,
      terminal_type: form.terminal_type || null,
      terminal_serial: form.terminal_serial || null,
      equipment_cost: form.equipment_cost ? parseFloat(form.equipment_cost) : null,
      free_equipment: form.free_equipment || null,
      monthly_volume: form.monthly_volume ? parseFloat(form.monthly_volume) : null,
      last_month_residual: form.last_month_residual ? parseFloat(form.last_month_residual) : null,
      average_residual: form.average_residual ? parseFloat(form.average_residual) : null,
      chargeback_count: form.chargeback_count ? parseInt(form.chargeback_count) : null,
      chargeback_volume: form.chargeback_volume ? parseFloat(form.chargeback_volume) : null,
      chargeback_ratio: form.chargeback_ratio ? parseFloat(form.chargeback_ratio) : null,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      router.push('/dashboard/merchants')
    }
  }

  const inputClass = 'w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  const labelClass = 'text-base text-slate-500 block mb-1'
  const sectionClass = 'bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6'

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/dashboard/merchants" className="text-slate-400 hover:text-slate-900 text-sm transition">← Back to Merchants</Link>
          <h2 className="text-xl lg:text-2xl font-bold mt-2">Add New Merchant</h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm mb-6 max-w-4xl">{error}</div>
        )}

        <div className="max-w-4xl space-y-0">
          {/* Business Information */}
          <div className={sectionClass}>
            <h3 className="font-semibold mb-4">Business Information</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Business Name *</label>
                  <input type="text" value={form.business_name} onChange={(e) => updateField('business_name', e.target.value)} className={inputClass} placeholder="ABC Coffee Shop" />
                </div>
                <div>
                  <label className={labelClass}>DBA Name</label>
                  <input type="text" value={form.dba_name} onChange={(e) => updateField('dba_name', e.target.value)} className={inputClass} placeholder="Doing business as..." />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className={labelClass}>Street</label>
                  <input type="text" value={form.business_street} onChange={(e) => updateField('business_street', e.target.value)} className={inputClass} placeholder="123 Main St" />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input type="text" value={form.business_city} onChange={(e) => updateField('business_city', e.target.value)} className={inputClass} placeholder="New York" />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" value={form.business_state} onChange={(e) => updateField('business_state', e.target.value)} className={inputClass} placeholder="NY" />
                </div>
                <div>
                  <label className={labelClass}>Zip</label>
                  <input type="text" value={form.business_zip} onChange={(e) => updateField('business_zip', e.target.value)} className={inputClass} placeholder="10001" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Contact Name</label>
                  <input type="text" value={form.contact_name} onChange={(e) => updateField('contact_name', e.target.value)} className={inputClass} placeholder="John Smith" />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputClass} placeholder="john@example.com" />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} placeholder="(555) 123-4567" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>MID (Merchant ID)</label>
                  <input type="text" value={form.mid} onChange={(e) => updateField('mid', e.target.value)} className={inputClass} placeholder="e.g. 4445012345678" />
                </div>
                <div>
                  <label className={labelClass}>Processor</label>
                  <input type="text" value={form.processor} onChange={(e) => updateField('processor', e.target.value)} className={inputClass} placeholder="e.g. Fiserv, TSYS" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={(e) => updateField('status', e.target.value)} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} className={inputClass + ' h-32 resize-none'} placeholder="Additional details about this merchant..." />
              </div>
            </div>
          </div>

          {/* Pricing & Fees */}
          <div className={sectionClass}>
            <h3 className="font-semibold mb-4">Pricing & Fees</h3>
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Pricing Type</label>
                <select value={form.pricing_type} onChange={(e) => updateField('pricing_type', e.target.value)} className={inputClass}>
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
                  <input type="number" step="0.01" value={form.pricing_rate} onChange={(e) => updateField('pricing_rate', e.target.value)} className={inputClass} placeholder="0.25" />
                </div>
                <div>
                  <label className={labelClass}>Per Transaction Fee ($)</label>
                  <input type="number" step="0.01" value={form.per_transaction_fee} onChange={(e) => updateField('per_transaction_fee', e.target.value)} className={inputClass} placeholder="0.10" />
                </div>
                <div>
                  <label className={labelClass}>Monthly Fees ($)</label>
                  <input type="number" step="0.01" value={form.monthly_fees} onChange={(e) => updateField('monthly_fees', e.target.value)} className={inputClass} placeholder="9.95" />
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

          {/* Full Fee Details */}
          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: showFullFees ? '5000px' : '0px', opacity: showFullFees ? 1 : 0 }}>
            {/* Rate Details */}
            <div className={sectionClass}>
              <h4 className="text-base font-semibold text-slate-700 mb-4">Rate Details</h4>
              {form.pricing_type === 'interchange_plus' && (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Percentage Markups</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <label className={labelClass}>Visa (%)</label>
                        <input type="number" step="0.01" value={form.ic_plus_visa_pct} onChange={(e) => updateField('ic_plus_visa_pct', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>MC (%)</label>
                        <input type="number" step="0.01" value={form.ic_plus_mc_pct} onChange={(e) => updateField('ic_plus_mc_pct', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>AMEX (%)</label>
                        <input type="number" step="0.01" value={form.ic_plus_amex_pct} onChange={(e) => updateField('ic_plus_amex_pct', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Disc (%)</label>
                        <input type="number" step="0.01" value={form.ic_plus_disc_pct} onChange={(e) => updateField('ic_plus_disc_pct', e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Per Transaction</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <label className={labelClass}>Visa ($)</label>
                        <input type="number" step="0.001" value={form.ic_plus_visa_txn} onChange={(e) => updateField('ic_plus_visa_txn', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>MC ($)</label>
                        <input type="number" step="0.001" value={form.ic_plus_mc_txn} onChange={(e) => updateField('ic_plus_mc_txn', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>AMEX ($)</label>
                        <input type="number" step="0.001" value={form.ic_plus_amex_txn} onChange={(e) => updateField('ic_plus_amex_txn', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Disc ($)</label>
                        <input type="number" step="0.001" value={form.ic_plus_disc_txn} onChange={(e) => updateField('ic_plus_disc_txn', e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Interchange Remittance</label>
                    <select value={form.interchange_remittance} onChange={(e) => updateField('interchange_remittance', e.target.value)} className={inputClass}>
                      <option value="">Select...</option>
                      <option value="daily">Daily</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              )}
              {form.pricing_type === 'dual_pricing' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Dual Pricing Rate (%)</label>
                    <input type="number" step="0.01" value={form.dual_pricing_rate} onChange={(e) => updateField('dual_pricing_rate', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Per Transaction Fee ($)</label>
                    <input type="number" step="0.01" value={form.dual_pricing_txn_fee} onChange={(e) => updateField('dual_pricing_txn_fee', e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
              {form.pricing_type === 'flat_rate' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Flat Rate (%)</label>
                    <input type="number" step="0.01" value={form.flat_rate_pct} onChange={(e) => updateField('flat_rate_pct', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Per Transaction ($)</label>
                    <input type="number" step="0.01" value={form.flat_rate_txn_cost} onChange={(e) => updateField('flat_rate_txn_cost', e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
              {(form.pricing_type === 'tiered' || form.pricing_type === 'surcharging') && (
                <p className="text-slate-400 text-sm">Configuration coming soon</p>
              )}
              {!form.pricing_type && (
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
                    <input type="number" step="0.01" value={form.fee_chargeback} onChange={(e) => updateField('fee_chargeback', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Retrievals</label>
                    <input type="number" step="0.01" value={form.fee_retrieval} onChange={(e) => updateField('fee_retrieval', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Arbitration</label>
                    <input type="number" step="0.01" value={form.fee_arbitration} onChange={(e) => updateField('fee_arbitration', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Voice Auths</label>
                    <input type="number" step="0.01" value={form.fee_voice_auth} onChange={(e) => updateField('fee_voice_auth', e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className={labelClass}>EBT Auths</label>
                    <input type="number" step="0.01" value={form.fee_ebt_auth} onChange={(e) => updateField('fee_ebt_auth', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Gateway Monthly</label>
                    <input type="number" step="0.01" value={form.fee_gateway_monthly} onChange={(e) => updateField('fee_gateway_monthly', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Gateway Per Txn</label>
                    <input type="number" step="0.01" value={form.fee_gateway_txn} onChange={(e) => updateField('fee_gateway_txn', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ACH Reject</label>
                    <input type="number" step="0.01" value={form.fee_ach_reject} onChange={(e) => updateField('fee_ach_reject', e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Fees */}
            <div className={sectionClass}>
              <h4 className="text-base font-semibold text-slate-700 mb-4">Monthly Fees</h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Statement Fee ($)</label>
                    <input type="number" step="0.01" value={form.monthly_fee_statement} onChange={(e) => updateField('monthly_fee_statement', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Custom Fee Name</label>
                    <input type="text" value={form.monthly_fee_custom_name} onChange={(e) => updateField('monthly_fee_custom_name', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Custom Fee Amount ($)</label>
                    <input type="number" step="0.01" value={form.monthly_fee_custom_amount} onChange={(e) => updateField('monthly_fee_custom_amount', e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>PCI Compliance Monthly ($)</label>
                    <input type="number" step="0.01" value={form.pci_compliance_monthly} onChange={(e) => updateField('pci_compliance_monthly', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>PCI Compliance Annual ($)</label>
                    <input type="number" step="0.01" value={form.pci_compliance_annual} onChange={(e) => updateField('pci_compliance_annual', e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contract & Equipment */}
          <div className={sectionClass}>
            <h3 className="font-semibold mb-4">Contract & Equipment</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Boarding Date</label>
                  <input type="date" value={form.boarding_date} onChange={(e) => updateField('boarding_date', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contract Length (months)</label>
                  <input type="number" value={form.contract_length_months} onChange={(e) => updateField('contract_length_months', e.target.value)} className={inputClass} placeholder="36" />
                </div>
                <div>
                  <label className={labelClass}>Contract End Date</label>
                  <input type="date" value={form.contract_end_date} onChange={(e) => updateField('contract_end_date', e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Terminal Type</label>
                  <input type="text" value={form.terminal_type} onChange={(e) => updateField('terminal_type', e.target.value)} className={inputClass} placeholder="e.g. Dejavoo QD4" />
                </div>
                <div>
                  <label className={labelClass}>Terminal Serial #</label>
                  <input type="text" value={form.terminal_serial} onChange={(e) => updateField('terminal_serial', e.target.value)} className={inputClass} placeholder="SN-123456" />
                </div>
                <div>
                  <label className={labelClass}>Equipment Cost ($)</label>
                  <input type="number" step="0.01" value={form.equipment_cost} onChange={(e) => updateField('equipment_cost', e.target.value)} className={inputClass} placeholder="299.00" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Free Equipment</label>
                <select value={form.free_equipment} onChange={(e) => updateField('free_equipment', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Financials & Risk */}
          <div className={sectionClass}>
            <h3 className="font-semibold mb-4">Financials & Risk</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Monthly Volume ($)</label>
                  <input type="number" step="0.01" value={form.monthly_volume} onChange={(e) => updateField('monthly_volume', e.target.value)} className={inputClass} placeholder="25000" />
                </div>
                <div>
                  <label className={labelClass}>Last Month Residual ($)</label>
                  <input type="number" step="0.01" value={form.last_month_residual} onChange={(e) => updateField('last_month_residual', e.target.value)} className={inputClass} placeholder="125.50" />
                </div>
                <div>
                  <label className={labelClass}>Average Residual ($)</label>
                  <input type="number" step="0.01" value={form.average_residual} onChange={(e) => updateField('average_residual', e.target.value)} className={inputClass} placeholder="118.00" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Chargeback Count</label>
                  <input type="number" value={form.chargeback_count} onChange={(e) => updateField('chargeback_count', e.target.value)} className={inputClass} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass}>Chargeback Volume ($)</label>
                  <input type="number" step="0.01" value={form.chargeback_volume} onChange={(e) => updateField('chargeback_volume', e.target.value)} className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>Chargeback Ratio (%)</label>
                  <input type="number" step="0.01" value={form.chargeback_ratio} onChange={(e) => updateField('chargeback_ratio', e.target.value)} className={inputClass} placeholder="0.00" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Merchant'}
            </button>
            <Link href="/dashboard/merchants" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-medium transition">Cancel</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
