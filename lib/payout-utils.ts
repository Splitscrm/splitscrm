/**
 * Shared waterfall calculation for agent payouts.
 * Used by Agent Payouts tab, Residual Trending, and Partner Profitability.
 */

export interface WaterfallInput {
  netRevenue: number
  isRestricted: boolean
  rc: { split_pct?: number; house_split_override_pct?: number; restricted_split_pct?: number; payout_type?: string; code_type?: string } | null
  orgHouseSplit: number
  parentOverridePct: number // from parent member's override_pct, or 0
}

export interface WaterfallResult {
  isoCut: number
  overrideAmt: number
  splitPct: number
  agentPayout: number
  isPassThrough: boolean // true for partner_direct / override / direct_sub
}

export function calcWaterfall(input: WaterfallInput): WaterfallResult {
  const { netRevenue, isRestricted, rc, orgHouseSplit, parentOverridePct } = input
  const codeType = rc?.code_type || 'standard'
  const isPartnerDirect = rc?.payout_type === 'partner_direct'

  // Partner-direct / override / direct_sub: no waterfall, pass through
  if (isPartnerDirect || codeType === 'override' || codeType === 'direct_sub') {
    return { isoCut: 0, overrideAmt: 0, splitPct: 100, agentPayout: netRevenue, isPassThrough: true }
  }

  // Agent-paid standard: full waterfall
  const housePct = rc?.house_split_override_pct ?? orgHouseSplit
  const isoCut = netRevenue * (housePct / 100)
  let remainder = netRevenue - isoCut

  let overrideAmt = 0
  if (parentOverridePct > 0) {
    overrideAmt = remainder * (parentOverridePct / 100)
    remainder -= overrideAmt
  }

  const splitPct = isRestricted && rc?.restricted_split_pct ? rc.restricted_split_pct : (rc?.split_pct ?? 0)
  const agentPayout = remainder * (splitPct / 100)

  return { isoCut, overrideAmt, splitPct, agentPayout, isPassThrough: false }
}

/**
 * For a set of records in a month, compute total agent payout cost.
 * Returns { totalAgentCost, totalOverrides, unassignedCount, unassignedRevenue }
 */
export function calcMonthAgentCosts(
  monthRecords: { net_revenue: number; merchant_id: string | null; merchant_id_external: string | null; agent_user_id: string | null; import_id: string }[],
  ctx: {
    importPartnerMap: Record<string, string>
    repCodesByUserPartner: Record<string, any[]>
    merchantRiskMap: Record<string, boolean>
    orgHouseSplit: number
    memberOverrideMap: Record<string, number> // user_id → parent's override_pct
  }
): { totalAgentCost: number; totalOverrides: number; unassignedCount: number; unassignedRevenue: number } {
  let totalAgentCost = 0
  let totalOverrides = 0
  let unassignedCount = 0
  let unassignedRevenue = 0

  for (const r of monthRecords) {
    const netRev = r.net_revenue || 0
    if (!r.agent_user_id) {
      unassignedCount++
      unassignedRevenue += netRev
      continue
    }

    const pid = ctx.importPartnerMap[r.import_id] || ''
    const agentCodes = ctx.repCodesByUserPartner[`${r.agent_user_id}:${pid}`] || []
    const rc = agentCodes[0] || null
    const mid = r.merchant_id || r.merchant_id_external || ''
    const isRestricted = mid ? (ctx.merchantRiskMap[mid] || false) : false

    const result = calcWaterfall({
      netRevenue: netRev,
      isRestricted,
      rc,
      orgHouseSplit: ctx.orgHouseSplit,
      parentOverridePct: ctx.memberOverrideMap[r.agent_user_id] || 0,
    })

    totalAgentCost += result.agentPayout
    totalOverrides += result.overrideAmt
  }

  return { totalAgentCost, totalOverrides, unassignedCount, unassignedRevenue }
}
