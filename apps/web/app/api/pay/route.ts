/**
 * POST /api/pay
 * Partner's responsibility: Claude agent calls this to trigger a payment.
 * Body: { registry_id, canonical_url, amount, creator_wallet }
 * Uses the GatewayClient from agent.mts pattern to fire the payment.
 * Returns: { success, tx_hash, amount_usdc }
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { registry_id, canonical_url, amount, creator_wallet } = body

  if (!registry_id || !canonical_url || !amount || !creator_wallet) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    /**
     * TODO (partner): Replace this stub with real GatewayClient payment.
     * Pattern from agent.mts:
     *
     * import { GatewayClient } from "@circle-fin/x402-batching/client"
     * const gateway = new GatewayClient({
     *   chain: "arcTestnet",
     *   privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`
     * })
     * const result = await gateway.pay(canonical_url, { method: "GET" })
     * return { tx_hash: result.transaction, amount_usdc: result.formattedAmount }
     */

    // Stub response for frontend development — replace with real gateway call
    const stub_tx_hash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`

    // Record payment in Supabase
    await supabase.from("griot_payments").insert({
      registry_id,
      endpoint: canonical_url,
      payer: "agent",
      creator_wallet,
      amount_usdc: amount,
      network: "eip155:5042002",
      gateway_tx: stub_tx_hash,
    })

    // Update registry stats
    await supabase.rpc("increment_registry_stats", {
      p_registry_id: registry_id,
      p_amount: amount,
    })

    return NextResponse.json({
      success: true,
      tx_hash: stub_tx_hash,
      amount_usdc: amount,
      creator_wallet,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
