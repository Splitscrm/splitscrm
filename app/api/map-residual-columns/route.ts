import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthenticatedUser } from '@/lib/api-auth'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedUser(req)

    const { headers, sampleRows, processorName } = await req.json()

    if (!headers || !sampleRows) {
      return NextResponse.json({ error: 'Missing headers or sampleRows' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a payment processing residual report expert. Given these CSV column headers and sample data rows, map each column to a standardized field name.

Headers: ${JSON.stringify(headers)}
Sample rows (first 5): ${JSON.stringify(sampleRows)}
Processor name (if known): ${processorName || 'Unknown'}

Return ONLY valid JSON with no markdown. Map each header to one of these standardized fields (use null if the column doesn't map to anything useful):

{
  "mapping": {
    "OriginalColumnName": "standardized_field_name",
    ...
  },
  "header_rows_to_skip": 0,
  "has_totals_row": false,
  "multi_row_per_merchant": false,
  "confidence": "high|medium|low",
  "notes": "any observations about the file format"
}

Standardized field names (use exactly these):
- merchant_id_external (the MID or merchant number)
- dba_name (business name / DBA)
- sales_count (number of sales transactions)
- sales_amount (total sales volume in dollars)
- credit_count (number of refund transactions)
- credit_amount (total refund volume)
- net_volume (net processing volume)
- transaction_count (total transactions)
- interchange_cost (interchange fees paid)
- dues_assessments (card brand dues and assessments)
- processing_fees (processor fees)
- gross_income (total income before expenses)
- total_expenses (total expenses/costs)
- net_revenue (net revenue after all costs)
- agent_id_external (agent/rep code)
- agent_split_pct (agent split percentage)
- agent_payout (agent payout amount)
- iso_net (ISO net after agent payout)
- report_month (reporting period)
- fee_category (fee type/category)
- description (description or notes)
- null (column should be ignored)

Be smart about variations: 'Merch Nbr', 'MID', 'Merchant Number', 'merchant_id' all map to merchant_id_external. 'DBA', 'DBA Name', 'Business Name', 'Merchant Name' all map to dba_name. Handle ALL CAPS column names, underscored names, and spaced names.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json({
      mapping: result.mapping,
      header_rows_to_skip: result.header_rows_to_skip ?? 0,
      has_totals_row: result.has_totals_row ?? false,
      multi_row_per_merchant: result.multi_row_per_merchant ?? false,
      confidence: result.confidence ?? 'medium',
      notes: result.notes ?? '',
    })
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Column mapping error:', error)
    return NextResponse.json({ error: 'Failed to map columns' }, { status: 500 })
  }
}
