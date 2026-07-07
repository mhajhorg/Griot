/**
 * Shared article scraping helper, using @extractus/article-extractor
 * per the brief (replaces the old manual regex HTML stripping).
 *
 * Used by both routes/fetch.js and routes/agent.js so the two don't
 * duplicate (and drift from) the same scraping logic.
 */

import { extract } from '@extractus/article-extractor';

/**
 * Fetch a URL and extract clean article content from it.
 * @param {string} url
 * @returns {Promise<{title:string, content:string, word_count:number, source_url:string}>}
 */
export async function extractArticle(url) {
  const article = await extract(url, {}, {
    headers: {
      'User-Agent': 'Griot/1.0 (content-fetcher; +https://griot.xyz)',
    },
  });

  if (!article) {
    throw new Error('Could not extract article content from URL');
  }

  // article-extractor returns HTML in `.content` — strip tags for a plain-text version.
  const cleaned = (article.content || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

  return {
    title: article.title || 'Untitled',
    content: cleaned,
    word_count: wordCount,
    source_url: url,
  };
}
