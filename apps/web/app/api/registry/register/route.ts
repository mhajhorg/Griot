/**
 * POST /api/registry/register
 * Partner's responsibility: register a creator's content in the Griot registry.
 * Body: { original_url, title, content, price, wallet_address, mode, creator_id }
 */
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
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

  // Build a unique canonical URL slug
  const baseSlug = slugify(title)
  const canonical_url = `${process.env.NEXT_PUBLIC_APP_URL}/read/${baseSlug}-${Date.now()}`

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

  return NextResponse.json({ success: true, entry: data }, { status: 201 })
}
