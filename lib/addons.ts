// ── Add-on Definitions & Helpers ─────────────────────────────────────────

export interface AddonDef {
  key: string
  name: string
  description: string
  price: number          // monthly $ amount
  minPlan: 'starter' | 'growth'
  includedInPro: boolean
  stackable?: boolean    // true = user can buy multiple blocks
}

export const ADDONS: AddonDef[] = [
  {
    key: 'agent_hierarchy',
    name: 'Agent Hierarchy',
    description: 'Full agent hierarchy with master agent → agent → sub-agent waterfall splits',
    price: 49,
    minPlan: 'growth',
    includedInPro: true,
  },
  {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Portfolio concentration risk, attrition analysis, BPS trending',
    price: 39,
    minPlan: 'growth',
    includedInPro: true,
  },
  {
    key: 'pdf_statements',
    name: 'PDF Statements',
    description: 'Branded per-agent monthly payout statements',
    price: 29,
    minPlan: 'growth',
    includedInPro: true,
  },
  {
    key: 'custom_permissions',
    name: 'Custom Permissions',
    description: 'Custom permission overrides per team member',
    price: 29,
    minPlan: 'growth',
    includedInPro: true,
  },
  {
    key: 'extra_ai_50',
    name: 'Extra AI Extractions',
    description: 'Additional 50 AI PDF extractions per month',
    price: 19,
    minPlan: 'growth',
    includedInPro: false,
    stackable: true,
  },
  {
    key: 'extra_storage_25gb',
    name: 'Extra Storage',
    description: 'Additional 25 GB document storage',
    price: 9,
    minPlan: 'growth',
    includedInPro: false,
    stackable: true,
  },
]

export const ADDON_MAP: Record<string, AddonDef> = Object.fromEntries(
  ADDONS.map((a) => [a.key, a])
)

// Plan hierarchy for comparison
const PLAN_RANK: Record<string, number> = {
  trial: 0,
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4,
}

/**
 * Returns true if the addon is currently active for the given organization.
 * Pro and enterprise plans auto-include addons that have includedInPro = true.
 */
export function isAddonActive(org: any, addonKey: string): boolean {
  if (!org) return false
  const def = ADDON_MAP[addonKey]
  const plan = org.plan || org.plan_limits?.plan || ''
  // Pro/enterprise auto-include
  if (def?.includedInPro && (plan === 'pro' || plan === 'enterprise')) return true
  // Check active_addons array
  const active: string[] = org.active_addons || []
  return active.includes(addonKey)
}

/**
 * Returns true if the org's plan meets the minimum plan requirement.
 */
export function canPurchaseAddon(org: any, addonKey: string): boolean {
  if (!org) return false
  const def = ADDON_MAP[addonKey]
  if (!def) return false
  const plan = org.plan || org.plan_limits?.plan || ''
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[def.minPlan] ?? 0)
}
