/**
 * GET /api/registry/check?url=<url>
 * Partner's responsibility: check if a URL is registered in the Griot registry.
 * Returns price, wallet, and mode so the Claude agent can decide whether to pay.
 */
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/supabase/route-client"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 })
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ registered: false })
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
