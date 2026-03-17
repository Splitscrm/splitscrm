'use client'

import { type ReactNode, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ADDON_MAP, isAddonActive, canPurchaseAddon } from '@/lib/addons'
import { supabase } from '@/lib/supabase'

interface FeatureGateProps {
  addonKey: string
  children: ReactNode
}

export default function FeatureGate({ addonKey, children }: FeatureGateProps) {
  const { org, member, refreshAuth } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [enabling, setEnabling] = useState(false)

  const addon = ADDON_MAP[addonKey]
  if (!addon) return <>{children}</>

  const active = isAddonActive(org, addonKey)
  if (active) return <>{children}</>

  const canBuy = canPurchaseAddon(org, addonKey)
  const isOwner = member?.role === 'owner'

  async function handleEnable() {
    if (!org?.id) return
    setEnabling(true)
    try {
      const currentAddons: string[] = org.active_addons || []
      const currentBilling = org.addon_billing || {}
      const now = new Date().toISOString()

      const { error } = await supabase
        .from('organizations')
        .update({
          active_addons: [...currentAddons, addonKey],
          addon_billing: {
            ...currentBilling,
            [addonKey]: { activated_at: now, price: addon.price },
          },
        })
        .eq('id', org.id)

      if (!error) {
        await refreshAuth()
        setShowModal(false)
      }
    } finally {
      setEnabling(false)
    }
  }

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="pointer-events-none select-none filter blur-[2px] opacity-60">
        {children}
      </div>

      {/* Locked overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl">
        <div className="text-center max-w-sm px-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{addon.name}</h3>
          <p className="text-sm text-slate-500 mt-1">{addon.description}</p>
          <p className="text-sm font-medium text-slate-700 mt-2">${addon.price}/mo</p>

          {!canBuy ? (
            <p className="text-sm text-amber-600 mt-3 font-medium">
              Upgrade to Growth to access add-ons
            </p>
          ) : !isOwner ? (
            <p className="text-sm text-slate-500 mt-3">
              Ask your account owner to enable this add-on
            </p>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
            >
              Unlock Feature
            </button>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">
              Enable {addon.name} &mdash; ${addon.price}/mo
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              This will be added to your monthly subscription. Your next bill will include this charge.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Billing is managed manually during beta. You will receive an invoice for any add-ons enabled.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
              >
                {enabling ? 'Enabling...' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
