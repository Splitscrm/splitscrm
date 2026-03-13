'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SplitsLogo from '@/components/SplitsLogo'
import { supabase } from '@/lib/supabase'

const faqs = [
  {
    q: 'What processors do you support?',
    a: 'Splits works with any processor. Our AI auto-maps residual reports from Fiserv, TSYS, Worldpay, Paysafe, and more. If you can export a CSV, we can import it.',
  },
  {
    q: 'How is this different from IRIS CRM?',
    a: 'Splits offers modern AI-powered features at a fraction of the cost. IRIS charges $1,799/mo and takes up to 2 years to add new processor integrations. We use AI to support any processor format from day one, at $99/mo.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. We use Supabase with PostgreSQL and row-level security. Your data is isolated per organization, access is controlled by role-based permissions, and sensitive fields like SSNs use application-level AES-256 encryption with audit logging.',
  },
  {
    q: 'Can I import my existing data?',
    a: 'Yes. You can upload merchant lists, residual reports, and pricing schedules. Our AI handles the field mapping automatically, regardless of format.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Yes — 14-day free trial with full access to all features. No credit card required to start.',
  },
  {
    q: 'Can my agents access their own residuals?',
    a: 'Agent self-service portal is included in the Growth plan. Agents can view their own splits, merchant lists, and payout history without bothering you.',
  },
]

const processors = ['Fiserv', 'TSYS', 'Worldpay', 'Paysafe', 'Elavon', 'Priority']

const features = [
  {
    icon: <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" /></svg>,
    title: 'AI-Powered Residual Import',
    desc: 'Upload CSV or Excel files from any processor. AI auto-detects columns, maps fields, and normalizes data — no manual drag-and-drop mapping. Learns your processor\'s format and remembers it forever.',
  },
  {
    icon: <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    title: 'Smart Pricing Extraction',
    desc: 'Upload any partner\'s pricing schedule PDF. AI extracts every rate, fee, and revenue share structure into organized, searchable data in seconds. No more flipping through PDFs during prospect calls.',
  },
  {
    icon: <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M5 8h14M7 12h10M9 16h6" /></svg>,
    title: 'Full Pipeline Management',
    desc: 'Track every lead from first contact to live merchant. 10-stage pipeline, automated deal creation, document management, and one-click conversion to merchant accounts.',
  },
  {
    icon: <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    title: 'Portfolio Dashboard',
    desc: 'See your entire business at a glance. Active merchants, pipeline value, processing volume by processor, chargeback alerts, and upcoming follow-ups — all in real time.',
  },
]

const comparisonRows: { label: string; spreadsheet: { text: string; color: string }; iris: { text: string; color: string }; iso: { text: string; color: string } }[] = [
  { label: 'Price', spreadsheet: { text: 'Free', color: 'text-slate-500' }, iris: { text: '$1,799/mo', color: 'text-slate-500' }, iso: { text: '$99/mo', color: 'text-emerald-600 font-semibold' } },
  { label: 'Setup Time', spreadsheet: { text: 'Weeks of building', color: 'text-slate-400' }, iris: { text: 'Weeks of onboarding', color: 'text-slate-400' }, iso: { text: '5 minutes', color: 'text-emerald-600 font-semibold' } },
  { label: 'Residual Automation', spreadsheet: { text: 'Manual', color: 'text-red-400' }, iris: { text: 'Manual mapping', color: 'text-amber-500' }, iso: { text: 'AI auto-mapping', color: 'text-emerald-600' } },
  { label: 'Pricing Schedule Mgmt', spreadsheet: { text: 'PDF files in folders', color: 'text-red-400' }, iris: { text: 'Basic', color: 'text-amber-500' }, iso: { text: 'AI extraction from PDF', color: 'text-emerald-600' } },
  { label: 'Pipeline Tracking', spreadsheet: { text: 'None', color: 'text-red-400' }, iris: { text: 'Full', color: 'text-slate-600' }, iso: { text: 'Full', color: 'text-emerald-600' } },
  { label: 'Agent Splits', spreadsheet: { text: 'Manual calculation', color: 'text-red-400' }, iris: { text: 'Automated', color: 'text-slate-600' }, iso: { text: 'AI-powered', color: 'text-emerald-600' } },
  { label: 'Chargeback Alerts', spreadsheet: { text: 'None', color: 'text-red-400' }, iris: { text: 'Included', color: 'text-slate-600' }, iso: { text: 'Threshold warnings', color: 'text-emerald-600' } },
  { label: 'Mobile Access', spreadsheet: { text: 'Clunky', color: 'text-amber-500' }, iris: { text: 'Dated', color: 'text-amber-500' }, iso: { text: 'Modern, responsive', color: 'text-emerald-600' } },
  { label: 'Processor Support', spreadsheet: { text: 'N/A', color: 'text-slate-400' }, iris: { text: 'Limited (2yr cycles)', color: 'text-amber-500' }, iso: { text: 'Any processor', color: 'text-emerald-600' } },
]

const steps = [
  { num: '1', title: 'Upload Your Data', desc: 'Drop in your residual CSV, pricing PDF, or merchant list. Our AI handles the rest.' },
  { num: '2', title: 'See Instant Results', desc: 'Fields are auto-mapped, rates extracted, and splits calculated in seconds — not hours.' },
  { num: '3', title: 'Grow Your Portfolio', desc: 'Track leads, manage merchants, and monitor residuals from one beautiful dashboard.' },
]

export default function LandingPage() {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [router])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* NAV */}
      <nav className={`sticky top-0 z-50 transition-all duration-150 ${scrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <SplitsLogo size="md" variant="dark" />

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollTo('features')} className="text-slate-600 hover:text-slate-900 text-base transition duration-150">Features</button>
              <button onClick={() => scrollTo('pricing')} className="text-slate-600 hover:text-slate-900 text-base transition duration-150">Pricing</button>
              <button onClick={() => scrollTo('faq')} className="text-slate-600 hover:text-slate-900 text-base transition duration-150">FAQ</button>
              <Link href="/login" className="text-slate-600 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-lg text-base transition duration-150">Log In</Link>
              <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-base font-medium transition duration-150">Start Free Trial</Link>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-slate-600 hover:text-slate-900 w-12 h-12 flex items-center justify-center -mr-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden pb-4 space-y-2 bg-white">
              <button onClick={() => scrollTo('features')} className="block w-full text-left px-4 py-3 min-h-[48px] text-slate-600 hover:text-slate-900 text-base">Features</button>
              <button onClick={() => scrollTo('pricing')} className="block w-full text-left px-4 py-3 min-h-[48px] text-slate-600 hover:text-slate-900 text-base">Pricing</button>
              <button onClick={() => scrollTo('faq')} className="block w-full text-left px-4 py-3 min-h-[48px] text-slate-600 hover:text-slate-900 text-base">FAQ</button>
              <div className="flex gap-3 px-4 pt-2">
                <Link href="/login" className="text-slate-600 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-lg text-base transition duration-150">Log In</Link>
                <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-base font-medium transition duration-150">Start Free Trial</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-slate-900">
                Never Touch a Residual<br />
                <span className="text-emerald-600">Spreadsheet</span> Again
              </h1>
              <p className="mt-6 text-xl text-slate-500 leading-relaxed lg:max-w-lg">
                Upload your processor files. See your splits in seconds. Track your entire portfolio from one dashboard. Purpose-built for ISOs — starting at $99/mo.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4.5 rounded-lg font-semibold text-xl transition duration-150 shadow-lg shadow-emerald-600/20">
                  Start Free Trial
                </Link>
                <button onClick={() => scrollTo('how-it-works')} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-10 py-4.5 rounded-lg font-semibold text-xl transition duration-150">
                  Watch Demo
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-400">No credit card required · Set up in 5 minutes</p>
            </div>

            {/* Dashboard mockup */}
            <div className="hidden lg:block bg-slate-900 rounded-xl border border-slate-200 p-1 shadow-2xl" style={{ transform: 'perspective(1200px) rotateY(-3deg)' }}>
              <div className="rounded-lg overflow-hidden">
                {/* Top bar */}
                <div className="bg-slate-900 flex items-center gap-2 px-4 py-3">
                  <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                  <span className="ml-3 text-xs text-slate-500">Splits — Dashboard</span>
                </div>

                <div className="flex">
                  {/* Mini sidebar */}
                  <div className="w-32 bg-[#0F172A] p-3 hidden sm:block">
                    <div className="flex items-center gap-1.5 mb-4">
                      <span className="inline-block w-1.5 h-1.5 rounded-sm bg-emerald-500"></span>
                      <span className="text-[10px] font-bold text-white">Splits</span>
                    </div>
                    <div className="space-y-1">
                      {['Dashboard', 'Leads', 'Merchants', 'Partners'].map((n, i) => (
                        <div key={n} className={`text-[9px] px-2 py-1 rounded ${i === 0 ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{n}</div>
                      ))}
                    </div>
                  </div>

                  {/* Content area */}
                  <div className="flex-1 bg-[#F8FAFC] p-4">
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {[
                        { label: 'Active Merchants', val: '247' },
                        { label: 'Pipeline Value', val: '$1.2M' },
                        { label: 'Leads This Month', val: '38' },
                        { label: 'Active Partners', val: '6' },
                      ].map((s) => (
                        <div key={s.label} className="bg-white rounded-lg p-2 border border-slate-200">
                          <p className="text-[8px] text-slate-500 truncate">{s.label}</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{s.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Mini pipeline */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200 mb-3">
                      <p className="text-[9px] text-slate-500 mb-2 font-medium">Sales Pipeline</p>
                      <div className="space-y-1.5">
                        {[
                          { label: 'New Prospect', w: '85%', color: 'bg-emerald-500' },
                          { label: 'Qualified', w: '60%', color: 'bg-amber-400' },
                          { label: 'Submitted', w: '40%', color: 'bg-violet-500' },
                          { label: 'Signed', w: '25%', color: 'bg-emerald-600' },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-400 w-16 truncate">{r.label}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div className={`h-full rounded-full ${r.color}`} style={{ width: r.w }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini activity feed */}
                    <div className="space-y-1">
                      {[
                        { dot: 'bg-emerald-500', text: 'New deal created — ABC Coffee' },
                        { dot: 'bg-emerald-600', text: 'Lead converted to merchant' },
                        { dot: 'bg-violet-500', text: 'Document uploaded — Bank stmt' },
                      ].map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className={`w-1 h-1 rounded-full ${a.dot} shrink-0`}></div>
                          <p className="text-[8px] text-slate-500 truncate">{a.text}</p>
                          <span className="text-[7px] text-slate-400 shrink-0 ml-auto">2h ago</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN BAR */}
      <section className="bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { stat: '20+ hrs/month', desc: 'Time ISOs spend on residual spreadsheets' },
              { stat: '$1,799/mo', desc: 'Cost of the leading ISO CRM competitor' },
              { stat: '40-60%', desc: 'Of ISOs still use spreadsheets' },
            ].map((p, i) => (
              <div key={p.stat} className={`${i < 2 ? 'border-b border-slate-700 pb-8 sm:border-b-0 sm:pb-0' : ''}`}>
                <p className="text-4xl sm:text-5xl font-bold text-emerald-400">{p.stat}</p>
                <p className="text-slate-400 text-base mt-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-slate-500 text-sm uppercase tracking-wide mb-6">Works with any processor</p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {processors.map((p) => (
              <span key={p} className="bg-slate-100 border border-slate-200 rounded-full px-4 py-2 text-base text-slate-600">{p}</span>
            ))}
          </div>
          <p className="text-slate-600 text-lg mb-4">Join the beta — founding members get <span className="text-emerald-600 font-semibold">$49/mo locked in for life</span></p>
          <Link href="/signup" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-lg text-lg font-medium transition duration-150">Claim Founding Pricing</Link>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Everything You Need to Run Your ISO</h2>
            <p className="text-slate-500 mt-3 max-w-2xl mx-auto">Stop juggling spreadsheets, PDFs, and legacy software. One platform for your entire operation.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition duration-150">
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-base text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">How Splits Compares</h2>
            <p className="text-slate-500 mt-3">Built specifically for ISOs. Priced for real businesses.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-4 px-4 text-slate-500 text-base font-medium"></th>
                  <th className="hidden sm:table-cell text-center py-4 px-4 text-slate-500 text-base font-medium">Spreadsheets</th>
                  <th className="text-center py-4 px-4 text-slate-500 text-base font-medium">IRIS CRM</th>
                  <th className="text-center py-4 px-4 text-base font-semibold text-emerald-600 border-t-4 border-emerald-500 bg-emerald-50">Splits</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-3.5 px-4 text-base text-slate-700 font-medium">{row.label}</td>
                    <td className={`hidden sm:table-cell py-3.5 px-4 text-base text-center ${row.spreadsheet.color}`}>{row.spreadsheet.text}</td>
                    <td className={`py-3.5 px-4 text-base text-center ${row.iris.color}`}>{row.iris.text}</td>
                    <td className={`py-3.5 px-4 text-base text-center bg-emerald-50 ${row.iso.color}`}>{row.iso.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center mt-10">
            <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-3.5 rounded-lg text-lg font-medium transition duration-150">Start Free Trial</Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Get Started in 3 Steps</h2>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-3 gap-0 sm:gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden sm:block absolute top-5 left-[20%] right-[20%] h-0.5 bg-emerald-200"></div>

            {steps.map((s, i) => (
              <div key={s.num} className="text-center relative">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-bold mx-auto mb-5 relative z-10">
                  {s.num}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-base max-w-xs mx-auto">{s.desc}</p>
                {i < steps.length - 1 && <div className="sm:hidden h-8 w-0.5 bg-emerald-200 mx-auto mt-4"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Simple, Transparent Pricing</h2>
            <p className="text-slate-500 mt-3">No hidden fees. No contracts. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Starter</h3>
              <div className="mt-4 mb-6" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-6xl font-bold text-slate-900">$99</span>
                <span className="text-slate-400 text-lg">/mo</span>
              </div>
              <ul className="space-y-3 text-base text-slate-600 mb-8">
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Up to 200 merchants</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>1 user</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>50 AI extractions/mo</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>2 processor imports</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Full lead & deal management</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Partner management</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Email support</li>
              </ul>
              <Link href="/signup" className="block text-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-3.5 rounded-lg text-lg font-medium transition duration-150">Start Free Trial</Link>
            </div>

            {/* Growth */}
            <div className="bg-white rounded-xl p-8 border-2 border-emerald-500 shadow-sm relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Popular</span>
              <h3 className="text-xl font-semibold text-slate-900">Growth</h3>
              <div className="mt-4 mb-6" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-6xl font-bold text-slate-900">$149</span>
                <span className="text-slate-400 text-lg">/mo</span>
              </div>
              <ul className="space-y-3 text-base text-slate-600 mb-8">
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Up to 1,000 merchants</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Up to 5 users</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>200 AI extractions/mo</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Unlimited processor imports</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Agent self-service portal</li>
                <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#10003;</span>Priority support</li>
              </ul>
              <Link href="/signup" className="block text-center bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-lg text-lg font-medium transition duration-150">Start Free Trial</Link>
            </div>
          </div>

          <div className="text-center mt-8 space-y-3">
            <p className="text-slate-500 text-sm">Need more? Enterprise plans available — <a href="#" className="text-emerald-600 hover:text-emerald-700">contact us</a></p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 max-w-md mx-auto">
              <p className="text-slate-700 text-sm">Founding member pricing: First 50 ISOs get Starter at <span className="text-emerald-600 font-semibold">$49/mo for life</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {faqs.map((f, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left hover:bg-slate-50 transition duration-150"
                >
                  <span className="font-medium text-lg text-slate-900 pr-4">{f.q}</span>
                  <span className={`text-slate-400 transition-transform duration-150 shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}>&#9660;</span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-150 ease-in-out"
                  style={{ maxHeight: openFaq === i ? '300px' : '0px', opacity: openFaq === i ? 1 : 0 }}
                >
                  <p className="px-4 sm:px-6 pb-4 text-base text-slate-500 leading-relaxed">{f.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to Ditch the Spreadsheets?</h2>
          <p className="text-slate-400 mt-4 text-lg max-w-lg mx-auto">Join ISOs who are saving 20+ hours per month on residual management.</p>
          <div className="mt-8">
            <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4.5 rounded-lg font-semibold text-xl transition duration-150 inline-block shadow-lg shadow-emerald-600/20 w-full sm:w-auto">Start Your Free Trial</Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card required · Cancel anytime · Set up in 5 minutes</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SplitsLogo size="sm" variant="light" />
            <span className="text-slate-400 text-sm">&copy; 2026</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-white text-sm transition duration-150">Privacy Policy</a>
            <a href="#" className="text-slate-400 hover:text-white text-sm transition duration-150">Terms of Service</a>
            <a href="#" className="text-slate-400 hover:text-white text-sm transition duration-150">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
