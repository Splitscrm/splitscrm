'use client'

import { useState } from 'react'
import Link from 'next/link'

interface OnboardingRecord {
  wizard_completed: boolean
  profile_completed: boolean
  first_partner_added: boolean
  first_pricing_uploaded: boolean
  first_residual_imported: boolean
  first_lead_added: boolean
  onboarding_dismissed: boolean
  [key: string]: any
}

interface OnboardingChecklistProps {
  onboarding: OnboardingRecord
  onUpdate: (updates: Partial<OnboardingRecord>) => void
  onDismiss: () => void
}

const items = [
  {
    key: 'profile_completed',
    title: 'Set up your profile',
    subtitle: 'Add your name and company info',
    action: 'Complete',
    href: '/dashboard/settings',
  },
  {
    key: 'first_partner_added',
    title: 'Add your first partner',
    subtitle: 'Set up a processor relationship',
    action: 'Add Partner',
    href: '/dashboard/partners/new',
  },
  {
    key: 'first_pricing_uploaded',
    title: 'Upload a pricing schedule',
    subtitle: 'Let AI extract rates from a PDF',
    action: 'Upload',
    href: '/dashboard/partners',
  },
  {
    key: 'first_residual_imported',
    title: 'Import a residual report',
    subtitle: 'Upload a CSV and see AI column mapping',
    action: 'Import',
    href: '/dashboard/residuals',
  },
  {
    key: 'first_lead_added',
    title: 'Add your first lead',
    subtitle: 'Start building your sales pipeline',
    action: 'Add Lead',
    href: '/dashboard/leads/new',
  },
]

export default function OnboardingChecklist({ onboarding, onUpdate, onDismiss }: OnboardingChecklistProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const completedCount = items.filter((item) => onboarding[item.key]).length

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Getting Started</h3>
          <p className="text-sm text-slate-500">{completedCount} of 5 complete</p>
        </div>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-slate-400 hover:text-slate-600 text-sm transition-colors duration-150"
          >
            Dismiss
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Hide checklist? You can always find these actions in the sidebar.</span>
            <button
              onClick={onDismiss}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
            >
              Hide
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
            >
              Keep
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full mb-4">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / 5) * 100}%` }}
        />
      </div>

      {/* Checklist items */}
      <div>
        {items.map((item, idx) => {
          const completed = !!onboarding[item.key]
          return (
            <div
              key={item.key}
              className={`flex items-center py-3 ${idx < items.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              {/* Circle */}
              {completed ? (
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 border-2 border-slate-300 rounded-full shrink-0" />
              )}

              {/* Text */}
              <div className="ml-4 flex-1">
                <p className={`text-sm font-medium ${completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
              </div>

              {/* Action */}
              {completed ? (
                <span className="text-emerald-500 text-sm">Done</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors duration-150"
                >
                  {item.action} &rarr;
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
