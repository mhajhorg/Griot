/**
 * GET /api/registry/check?url=<url>
 * Partner's responsibility: check if a URL is registered in the Griot registry.
 * Returns price, wallet, and mode so the Claude agent can decide whether to pay.
 */
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 })
  }

  // Check by original_url OR canonical_url
  const { data, error } = await supabase
    .from("registry")
    .select("id, price, wallet_address, mode, canonical_url, title")
    .or(`original_url.eq.${url},canonical_url.eq.${url}`)
    .single()

  if (error || !data) {
    return NextResponse.json({ registered: false })
  }

  return NextResponse.json({
    registered: true,
    registry_id: data.id,
    price: data.price,
    wallet: data.wallet_address,
    mode: data.mode,
    canonical_url: data.canonical_url,
    title: data.title,
  })
}
