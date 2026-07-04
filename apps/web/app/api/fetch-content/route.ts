/**
 * POST /api/fetch-content
 * Partner's responsibility: fetch and clean content from any URL.
 * Handles X threads, blogs, Ghost, Medium, personal sites.
 * Body: { url }
 * Returns: { title, content, word_count, source_url }
 */
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GriotBot/1.0)",
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status}`)
    }

    const html = await res.text()

    // Basic HTML → text extraction
    // TODO (partner): replace with a proper parser like @extractus/article-extractor
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "Untitled"
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000) // cap at 8k chars to stay within Claude's context

    const word_count = bodyText.split(/\s+/).length

    return NextResponse.json({
      title,
      content: bodyText,
      word_count,
      source_url: url,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
