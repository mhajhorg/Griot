/**
 * GET /api/read/:slug
 * Partner's responsibility: the x402 payment gate.
 * Uses the existing withGateway wrapper from lib/x402.ts.
 * Looks up the registry entry by slug and serves content after payment.
 */
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { withGateway } from "@/lib/x402"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function readHandler(req: NextRequest): Promise<NextResponse> {
  const slug = req.nextUrl.pathname.split("/").pop()
  const canonical_url = `${process.env.NEXT_PUBLIC_APP_URL}/read/${slug}`

  const { data, error } = await supabase
    .from("registry")
    .select("id, title, content, price, wallet_address, creator_id, mode")
    .eq("canonical_url", canonical_url)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  // Record citation/payment in griot_payments
  await supabase.from("griot_payments").insert({
    registry_id: data.id,
    endpoint: canonical_url,
    payer: req.headers.get("x-payer") ?? "unknown",
    creator_wallet: data.wallet_address,
    amount_usdc: data.price,
    network: "eip155:5042002",
  })

  // Increment citation count and total earned
  await supabase
    .from("registry")
    .update({
      citation_count: supabase.rpc("increment", { row_id: data.id, field: "citation_count" }),
      total_earned: supabase.rpc("increment_by", { row_id: data.id, field: "total_earned", amount: data.price }),
    })
    .eq("id", data.id)

  return NextResponse.json({
    title: data.title,
    content: data.content,
    registry_id: data.id,
    creator_wallet: data.wallet_address,
  })
}

// Price is read from registry per-request but withGateway needs a static price.
// We use a dynamic wrapper: check registry first, build a gateway with that price.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const canonical_url = `${process.env.NEXT_PUBLIC_APP_URL}/read/${slug}`

  // Look up price for this specific article
  const { data } = await supabase
    .from("registry")
    .select("price, wallet_address")
    .eq("canonical_url", canonical_url)
    .single()

  if (!data) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  // Dynamically wrap handler with the correct price for this article
  const priceStr = `$${data.price.toFixed(6)}`
  const gatedHandler = withGateway(readHandler, priceStr, canonical_url)
  return gatedHandler(req)
}
