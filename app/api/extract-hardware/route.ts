import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { rateLimit, rateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit'

const RATE_LIMIT = 20
const WINDOW_MS = 60_000

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: RATE_LIMIT, windowMs: WINDOW_MS })
  if (!rl.success) return rateLimitResponse(RATE_LIMIT, rl.resetAt)
  const headers = rateLimitHeaders(RATE_LIMIT, rl.remaining, rl.resetAt)

  try {
    await getAuthenticatedUser(req)

    const formData = await req.formData()
    const pdf = formData.get('pdf') as File

    if (!pdf) {
      return NextResponse.json({ error: 'No PDF provided' }, { status: 400, headers })
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
              text: `You are a payment processing hardware expert. Extract ALL hardware items from this document into a structured JSON array.

Return ONLY valid JSON with no markdown or extra text. Each item should have:

[
  {
    "hardware_type": "terminal | mobile_reader | pos | pin_pad | printer | other",
    "hardware_name": "e.g. Dejavoo QD4",
    "model": "e.g. QD4",
    "manufacturer": "e.g. Dejavoo",
    "cost": 0.00,
    "msrp": 0.00,
    "free_placement_eligible": false,
    "notes": "any relevant notes"
  }
]

Extract every distinct hardware product mentioned. Use null for unknown numeric fields. Set free_placement_eligible to true only if the document explicitly mentions free placement or free terminal programs for that item.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const hardware = JSON.parse(clean)

    return NextResponse.json({ hardware: Array.isArray(hardware) ? hardware : [hardware] }, { headers })
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers })
    }
    console.error('Hardware extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract hardware data' }, { status: 500, headers })
  }
}
