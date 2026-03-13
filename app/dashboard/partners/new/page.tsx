'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PricingPreview from '@/components/PricingPreview'
import { authFetch } from '@/lib/api-client'
import Sidebar from '@/components/Sidebar'

export default function AddPartnerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [pricingSchedules, setPricingSchedules] = useState<any[]>([])

  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    residual_split: '',
    restricted_split_pct: '',
    notes: '',
  })

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const res = await authFetch('/api/extract-pricing', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.pricing) {
        setPricingSchedules((prev) => [...prev, data.pricing])
      } else {
        setError('Could not extract pricing from this PDF. You can still save the partner manually.')
      }
    } catch (err) {
      setError('PDF extraction failed. You can still save the partner manually.')
    }
    setExtracting(false)
    // Reset file input so same file can be re-uploaded
    e.target.value = ''
  }

  const removeSchedule = (index: number) => {
    setPricingSchedules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!form.name) {
      setError('Partner name is required')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase.from('partners').insert({
      user_id: user.id,
      name: form.name,
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone,
      website: form.website,
      residual_split: form.residual_split ? parseFloat(form.residual_split) : null,
      restricted_split_pct: form.restricted_split_pct ? parseFloat(form.restricted_split_pct) : null,
      notes: form.notes,
      pricing_data: pricingSchedules.length > 0 ? pricingSchedules : null,
      status: 'active',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Mark onboarding steps complete (fire-and-forget)
      const onboardingUpdates: Record<string, any> = { first_partner_added: true, updated_at: new Date().toISOString() }
      if (pricingSchedules.length > 0) onboardingUpdates.first_pricing_uploaded = true
      supabase.from('user_onboarding').update(onboardingUpdates).eq('user_id', user.id)
      router.push('/dashboard/partners')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 max-w-4xl">
        <Link href="/dashboard/partners" className="text-slate-400 hover:text-slate-900 text-sm mb-6 block">
          ← Back to Partners
        </Link>
        <h2 className="text-xl lg:text-2xl font-bold mb-8">Add New Partner</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-semibold mb-4 text-slate-700">Partner Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm text-slate-500 block mb-1">Partner Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. First Data, TSYS, Stripe"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Contact Name</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Rep name"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="rep@partner.com"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="https://partner.com"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Residual Split %</label>
                <input
                  type="number"
                  value={form.residual_split}
                  onChange={(e) => setForm({ ...form, residual_split: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. 50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Restricted / High-Risk Split %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.restricted_split_pct}
                  onChange={(e) => setForm({ ...form, restricted_split_pct: e.target.value })}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. 50"
                />
              </div>
            </div>
          </div>

          {/* PDF Upload */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-semibold mb-2 text-slate-700">Pricing Schedules</h3>
            <p className="text-slate-500 text-sm mb-4">Upload PDF pricing schedules and AI will automatically extract the rates and fees. You can upload multiple schedules (e.g. Schedule A for low risk, Schedule B for high risk).</p>

            <label className="block w-full border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 bg-slate-50 transition">
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              {extracting ? (
                <div>
                  <p className="text-emerald-600 text-lg mb-1">Extracting pricing data...</p>
                  <p className="text-slate-500 text-sm">AI is reading your PDF</p>
                </div>
              ) : (
                <div>
                  <p className="text-4xl mb-2">📄</p>
                  <p className="text-slate-600">Click to upload a pricing schedule PDF</p>
                  <p className="text-slate-500 text-sm mt-1">AI will auto-extract rates and fees</p>
                </div>
              )}
            </label>

            {pricingSchedules.length > 0 && (
              <div className="mt-4">
                <p className="text-emerald-600 text-sm font-medium mb-3">{pricingSchedules.length} schedule{pricingSchedules.length > 1 ? 's' : ''} extracted</p>
                <PricingPreview pricing={pricingSchedules} onRemove={removeSchedule} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-semibold mb-4 text-slate-700">Notes</h3>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="Additional notes about this partner..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Partner'}
            </button>
            <a
              href="/dashboard/partners"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-3 rounded-lg font-medium transition"
            >
              Cancel
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
