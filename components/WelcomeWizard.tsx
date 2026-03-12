'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import SplitsLogo from '@/components/SplitsLogo'
import { useAuth } from '@/lib/auth-context'

interface WelcomeWizardProps {
  onComplete: () => void
}

const merchantCountOptions = ['Just starting', '1-50', '51-200', '201-500', '500+']
const painPointOptions = ['Residual spreadsheets', 'Lead tracking', 'Partner management', 'Agent splits', 'All of the above']

const ALL_NEXT_STEPS = [
  { emoji: '🤝', title: 'Add your first processor partner', subtitle: 'Set up your processor relationships', href: '/dashboard/partners/new', roles: ['owner', 'manager'] },
  { emoji: '📊', title: 'Import a residual report', subtitle: 'Upload a CSV and let AI map your data', href: '/dashboard/residuals', roles: ['owner', 'manager'] },
  { emoji: '🎯', title: 'Add your first lead', subtitle: 'Start building your sales pipeline', href: '/dashboard/leads/new', roles: ['owner', 'manager', 'master_agent', 'agent', 'sub_agent', 'referral'] },
  { emoji: '📞', title: 'Log your first call', subtitle: 'Track communications with prospects', href: '/dashboard/leads', roles: ['master_agent', 'agent'] },
]

export default function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const { member, org } = useAuth()
  const role = member?.role || 'owner'
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const orgName = org?.name

  const [step, setStep] = useState(1)
  const [mounted, setMounted] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  // Form state — step 1
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state — step 2
  const [merchantCount, setMerchantCount] = useState('')
  const [painPoint, setPainPoint] = useState('')

  const nextSteps = useMemo(() =>
    ALL_NEXT_STEPS.filter(s => s.roles.includes(role)),
    [role]
  )

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const goToStep = (next: number) => {
    setTransitioning(true)
    setTimeout(() => {
      setStep(next)
      setTransitioning(false)
    }, 200)
  }

  const handleStep1Continue = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').upsert({
        id: user.id,
        full_name: fullName,
        company_name: companyName,
        phone: phone || null,
      }, { onConflict: 'id' })

      await supabase.from('user_onboarding').upsert({
        user_id: user.id,
        profile_completed: true,
      }, { onConflict: 'user_id' })
    }
    setSaving(false)
    goToStep(isOwnerOrManager ? 2 : 3)
  }

  const handleStep2Continue = async () => {
    goToStep(3)
  }

  const handleFinish = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_onboarding').upsert({
        user_id: user.id,
        wizard_completed: true,
      }, { onConflict: 'user_id' })
    }
    onComplete()
  }

  return (
    <div
      className={`fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8 transition-all duration-200 ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      >
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {(isOwnerOrManager ? [1, 2, 3] : [1, 3]).map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${s === step ? 'bg-emerald-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div className="flex justify-center mb-6">
              <SplitsLogo size="lg" variant="dark" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 text-center">Welcome to {orgName || 'Splits'}</h2>
            <p className="text-slate-500 text-center mb-8">
              The modern CRM for ISOs. Let&apos;s get you set up in 60 seconds.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 font-medium block mb-1.5">Full Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm placeholder:text-slate-400"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 font-medium block mb-1.5">Company Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm placeholder:text-slate-400"
                  placeholder="ABC Payments LLC"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 font-medium block mb-1.5">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white text-slate-900 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm placeholder:text-slate-400"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <button
              onClick={handleStep1Continue}
              disabled={!fullName.trim() || !companyName.trim() || saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-900 text-center">Tell us about your business</h2>
            <p className="text-slate-500 text-center mb-6">This helps us customize your experience</p>

            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3 text-center">How many merchants do you manage?</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {merchantCountOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setMerchantCount(opt)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                        merchantCount === opt
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-3 text-center">What&apos;s your biggest pain point?</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {painPointOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPainPoint(opt)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                        painPoint === opt
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleStep2Continue}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors duration-150 mt-8"
            >
              Continue
            </button>
            <button
              onClick={() => goToStep(3)}
              className="w-full text-slate-400 text-sm mt-3 hover:text-slate-500 transition-colors duration-150"
            >
              Skip
            </button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            {/* Checkmark icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 text-center">You&apos;re all set!</h2>
            <p className="text-slate-500 text-center mb-6">Here&apos;s what to do first:</p>

            <div className="flex flex-col gap-3">
              {nextSteps.map((ns) => (
                <a
                  key={ns.title}
                  href={ns.href}
                  className="flex items-center gap-4 bg-slate-50 hover:bg-slate-100 rounded-xl p-4 cursor-pointer border border-slate-200 transition-colors duration-150"
                >
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xl">{ns.emoji}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{ns.title}</p>
                    <p className="text-xs text-slate-500">{ns.subtitle}</p>
                  </div>
                </a>
              ))}
            </div>

            <button
              onClick={handleFinish}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors duration-150 mt-6"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
