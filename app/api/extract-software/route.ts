import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
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
              text: `You are a payment processing software/gateway expert. Extract ALL software products, gateways, and integrations from this PDF into a structured JSON array.

Return ONLY valid JSON with no markdown or extra text. Return an array of objects with this structure:

[
  {
    "software_name": "Name of the software or gateway",
    "software_type": "gateway | pos | plugin | integration | virtual_terminal | reporting",
    "manufacturer": "Company that makes this software",
    "monthly_cost": "Monthly fee as a number or null",
    "per_transaction_cost": "Per transaction fee as a number or null",
    "setup_fee": "One-time setup fee or null",
    "features": "Key features or capabilities",
    "notes": "Any important details, restrictions, or requirements"
  }
]

Extract every distinct software product, gateway, or integration mentioned. If pricing is not specified for a product, use null for cost fields.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const software = JSON.parse(clean)

    return NextResponse.json({ software: Array.isArray(software) ? software : [software] })
  } catch (error) {
    console.error('Software extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract software data' }, { status: 500 })
  }
}
