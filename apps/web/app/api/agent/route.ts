/**
 * POST /api/agent
 * Your responsibility (Ruze): Claude tool-use agent.
 * Body: { query, budget_usdc }
 * Returns: { summary, citations, total_paid }
 *
 * The agent autonomously:
 * 1. Decides which URLs to look up
 * 2. Checks the Griot registry for each
 * 3. Decides whether to pay based on price vs budget
 * 4. Calls /api/pay to fire the nanopayment
 * 5. Reads the content and synthesises a cited research output
 */
import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

const tools: Anthropic.Tool[] = [
  {
    name: "check_registry",
    description:
      "Check if a URL is registered on Griot and get its price and payment details. Always call this before citing any URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to check" },
      },
      required: ["url"],
    },
  },
  {
    name: "pay_and_fetch",
    description:
      "Pay the creator and fetch the full article content. Only call this after check_registry confirms the URL is registered and you decide it's worth paying for.",
    input_schema: {
      type: "object" as const,
      properties: {
        registry_id: { type: "string" },
        canonical_url: { type: "string" },
        amount: { type: "number", description: "Amount in USDC to pay" },
        creator_wallet: { type: "string" },
      },
      required: ["registry_id", "canonical_url", "amount", "creator_wallet"],
    },
  },
  {
    name: "fetch_free",
    description:
      "Fetch content from a URL that is NOT registered on Griot, at no cost.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
]

// Execute a tool call and return the result string
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "check_registry") {
    const res = await fetch(`${BASE_URL}/api/registry/check?url=${encodeURIComponent(input.url as string)}`)
    const data = await res.json()
    return JSON.stringify(data)
  }

  if (name === "pay_and_fetch") {
    const payRes = await fetch(`${BASE_URL}/api/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const payData = await payRes.json()
    if (!payData.success) return JSON.stringify({ error: "Payment failed" })

    // Fetch the content (payment receipt would be in real x402 header)
    const contentRes = await fetch(`${BASE_URL}/api/fetch-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.canonical_url }),
    })
    const contentData = await contentRes.json()
    return JSON.stringify({ ...contentData, tx_hash: payData.tx_hash, amount_paid: payData.amount_usdc })
  }

  if (name === "fetch_free") {
    const res = await fetch(`${BASE_URL}/api/fetch-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.url }),
    })
    const data = await res.json()
    return JSON.stringify(data)
  }

  return JSON.stringify({ error: "Unknown tool" })
}

export async function POST(req: NextRequest) {
  const { query, budget_usdc = 0.5 } = await req.json()

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 })
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `You are a research agent for Griot, a platform that pays creators when their content is cited by AI agents.

Research this query: "${query}"

Budget: $${budget_usdc} USDC total for this research session.

Instructions:
1. Identify 3-5 relevant URLs that would help answer this query
2. For each URL, call check_registry first to see if it's registered on Griot
3. If registered and within budget, call pay_and_fetch — you are paying the creator for their work
4. If not registered or too expensive, call fetch_free
5. Synthesise a comprehensive answer with inline citations
6. Track your total spending and stay within budget

For your final response, structure it as:
SUMMARY: [your research summary with [citation] markers]
CITATIONS: [list each source with: title | url | amount paid | tx hash]
TOTAL_PAID: [total USDC spent]`,
    },
  ]

  const citations: Array<{
    title: string
    url: string
    amount_paid: number
    tx_hash: string | null
  }> = []

  // Agentic loop — runs until Claude stops calling tools
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      tools,
      messages,
    })

    // Append assistant response to message history
    messages.push({ role: "assistant", content: response.content })

    // If no tool calls, Claude is done — extract final answer
    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("")

      return NextResponse.json({
        summary: text,
        citations,
        total_paid: citations.reduce((sum, c) => sum + c.amount_paid, 0),
      })
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== "tool_use") continue

      const result = await executeTool(block.name, block.input as Record<string, unknown>)
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      })

      // Track citations from pay_and_fetch calls
      if (block.name === "pay_and_fetch") {
        const parsed = JSON.parse(result)
        if (parsed.tx_hash) {
          citations.push({
            title: parsed.title ?? "Untitled",
            url: (block.input as { canonical_url: string }).canonical_url,
            amount_paid: (block.input as { amount: number }).amount,
            tx_hash: parsed.tx_hash,
          })
        }
      }
    }

    // Feed tool results back to Claude
    messages.push({ role: "user", content: toolResults })
  }
}
