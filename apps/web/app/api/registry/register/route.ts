/**
 * POST /api/registry/register
 * Partner's responsibility: register a creator's content in the Griot registry.
 * Body: { original_url, title, content, price, wallet_address, mode, creator_id }
 */
import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { getSupabaseClient } from "@/lib/supabase/route-client"

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

function normalizeCanonicalUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl)
  const path = parsed.pathname.replace(/\/+$/, "")
  return `${parsed.origin}${path}`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { original_url, title, content, price, wallet_address, mode, creator_id } = body

  if (!original_url || !title || !content || !price || !wallet_address || !mode || !creator_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (!["paywall", "citation"].includes(mode)) {
    return NextResponse.json({ error: "mode must be paywall or citation" }, { status: 400 })
  }

  // Build a canonical URL that matches the backend's normalization rules.
  const baseSlug = slugify(title)
  const canonical_url = (() => {
    try {
      return normalizeCanonicalUrl(original_url)
    } catch {
      return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/read/${baseSlug}-${Date.now()}`
    }
  })()

  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("registry")
    .insert({
      creator_id,
      original_url,
      canonical_url,
      title,
      content,
      price,
      wallet_address,
      mode,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const contentId = createHash("sha256").update(canonical_url).digest("hex").slice(0, 32)
  const entry = {
    id: data.id,
    content_id: data.content_id ?? contentId,
    canonical_url,
    price: Number(data.price),
    mode: data.mode,
    onchain_tx: data.onchain_tx ?? null,
  }

  return NextResponse.json({ success: true, entry }, { status: 201 })
}
