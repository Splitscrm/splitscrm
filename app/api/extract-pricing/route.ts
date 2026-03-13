import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthenticatedUser } from '@/lib/api-auth'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedUser(req)

    const formData = await req.formData()
    const pdf = formData.get('pdf') as File

    if (!pdf) {
      return NextResponse.json({ error: 'No PDF provided' }, { status: 400 })
    }

    const arrayBuffer = await pdf.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
             type: 'text',
              text: `You are a payment processing pricing expert. Extract ALL pricing data from this PDF schedule into a structured JSON object.

Return ONLY valid JSON with no markdown or extra text. Use this structure (include only fields that exist, use null for missing values):

{
  "schedule_name": "Name of the schedule/partner",
  "schedule_label": "Schedule tier label (e.g. Schedule A - Low Risk, Schedule B - High Risk)",
"risk_level": "low_risk | mid_risk | high_risk | mixed",
  "effective_date": "Date if listed",
  "pricing_model": "interchange_plus | dual_pricing | surcharging | tiered | flat_rate",
  "interchange_plus": "Buy rate markup if applicable",
  "bank_sponsorship_bps": "Basis points on volume",
  "transaction_fees": {
    "auth_fee": "Per authorization fee",
    "transaction_fee": "Per item/EDC fee",
    "debit_ebt_fee": "Debit/EBT per item",
    "amex_opt_blue": "AMEX Opt Blue rate",
    "avs_fee": "AVS per transaction",
    "batch_close_fee": "Batch close fee",
    "voice_auth_fee": "Voice/ARU authorization fee",
    "fleet_surcharge": "Fleet card surcharge"
  },
  "monthly_fees": {
    "customer_service_fee": "Monthly CS fee",
    "statement_fee": "Monthly statement fee",
    "monthly_minimum": "Monthly minimum fee",
    "debit_access_fee": "Debit monthly access",
    "fiserv_surcharge": "Fiserv/processor monthly surcharge",
    "tax_filing_fee": "Monthly tax filing fee",
    "wireless_fee": "Wireless monthly per terminal"
  },
  "chargeback_fees": {
    "chargeback_fee": "Per chargeback",
    "retrieval_fee": "Per retrieval",
    "arbitration_fee": "Chargeback arbitration fee"
  },
  "compliance_fees": {
    "pci_compliance_fee": "PCI compliance monthly",
    "pci_non_validation_fee": "PCI non-validation fee",
    "proactive_security_fee": "Proactive security fee",
    "rgs_coverage_fee": "RGS coverage fee",
    "breach_protection_fee": "Breach protection fee"
  },
  "annual_fees": {
    "annual_fee": "Annual fee amount",
    "annual_fee_schedule": "When charged"
  },
  "gateway_fees": {
    "gateway_monthly": "Gateway monthly fee",
    "gateway_transaction": "Gateway per transaction",
    "gateway_tokenization": "Tokenization fee",
    "gateway_provider": "Gateway provider name"
  },
  "other_fees": {
    "ach_discount_rate": "ACH discount rate",
    "ach_transaction_fee": "ACH per transaction",
    "ach_same_day_fee": "ACH same day fee",
    "ach_monthly_fee": "ACH monthly account fee",
    "ach_returns_fee": "ACH returns/NOC fee",
    "ach_unauthorized_returns": "ACH unauthorized returns fee",
    "invalid_tin_fee": "Invalid TIN fee",
    "dual_pricing_fee": "Dual pricing program fee",
    "same_day_funding_rate": "Same day funding rate",
    "gift_card_fee": "Gift card fee"
  },
  "revenue_share": {
    "low_risk_split": "Revenue share for low risk",
    "mid_risk_split": "Revenue share for mid risk",
    "mid_risk_definition": "How mid risk is defined"
  },
  "incentives": {
    "free_terminal": "Free terminal program details",
    "activation_bonus": "Per MID activation bonus",
    "etf_amount": "Early termination fee amount"
  },
  "notes": "Any important footnotes or conditions"
}`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const pricing = JSON.parse(clean)

    return NextResponse.json({ pricing })
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PDF extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract pricing' }, { status: 500 })
  }
}
