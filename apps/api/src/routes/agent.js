import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../supabase.js';
import { extractArticle } from '../lib/content-extractor.js';
import { chatCompletion, webSearch } from '../lib/blockrun.js';
import { payForCitationOnChain, ensureAgentApproval, computeContentId, getRegistryAddress, getUsdcStatus, getOnChainContent } from '../lib/arc.js';
import { sendContractCall } from '../lib/circle.js';
import { normalizeCanonicalUrl } from '../lib/url-utils.js';

export const agentRouter = Router();

const MAX_TURNS = 14;

// Built as a plain-text ReAct loop (model emits one JSON action per turn) rather
// than relying on native "tool use" / function-calling — BlockRun's free dev-tier
// models don't reliably support structured tool calling, and this approach works
// identically whether the model behind BLOCKRUN_MODEL is a free model or a paid
// one for the demo recording.
const SYSTEM_PROMPT = `You are Griot's research agent. You answer the user's query by combining Griot-registered
content with real external web sources — never guessing at URLs from memory.

Your workflow for every new query:
1. ALWAYS start with "search_registry" using short keyword(s) describing the topic. This checks whether
   any Griot creator has already registered relevant content, and returns the FULL TEXT of any match
   directly — you do not need to call fetch_content for anything search_registry already gave you content
   for. If a registered match is relevant, you MUST cite it using the EXACT canonical_url the search
   result gave you — never substitute a URL you recall from your own training data for "the same" source.
2. Then use "web_search" to find real, currently-existing external sources for anything the registry
   doesn't cover, or to add supporting context and depth. Never invent a URL yourself — only cite URLs
   that came back from search_registry or web_search results.
3. Use "fetch_content" only on external URLs from web_search that you actually need the full text of —
   never on a URL search_registry already gave you content for.
4. For a thorough research question (an essay, term paper, or multi-part question), aim to cite MULTIPLE
   sources — combine registered Griot content where available with several external sources, rather than
   relying on just one or two.
5. If search_registry and web_search both come back empty or irrelevant for a simple factual question,
   it's fine to answer directly from your own knowledge with an empty citations array — don't keep
   retrying fetch_content on guessed URLs.

Writing your final answer:
- Do NOT paste raw scraped text. Read the fetched content, then write a clean, well-organized answer in
  your own words — like a well-edited article or essay, with clear paragraphs (and headers/sections for
  longer research answers), not a jumbled dump of source material.
- Reference sources inline using bracketed numbers matching their order in your citations array, e.g.
  "...as shown in recent benchmarks [1]." so the reader can see which fact came from which source.
- Keep shorter factual answers concise; for essay/term-paper-style requests, write in full, substantive
  depth — multiple paragraphs or sections as the topic warrants.

Respond with EXACTLY ONE JSON object per turn, nothing else — no prose, no markdown fences. Valid shapes:
{"action": "search_registry", "query": "..."}
{"action": "web_search", "query": "..."}
{"action": "fetch_content", "url": "..."}
{"action": "final", "summary": "...", "citations": [{"title": "...", "url": "..."}]}

Do not include a "pay" action — payment for any registered content you cite is handled automatically by
the system after you finish, based on which URLs you fetched and cited. You never need to think about
payment yourself; just cite whatever best answers the query, registered or not.`;

const CONVERSATIONAL_PATTERNS = [
  /^(thanks|thank you|thx|ty|cheers|ok|okay|cool|got it|makes sense|great|nice|perfect|awesome|sure|alright|sounds good|i see|interesting|noted|understood|no problem|np|yes|no|yep|nope|right|correct|exactly|hi|hello|hey)[.!?]?$/i,
];

function isConversational(text) {
  const trimmed = (text || '').trim();
  if (CONVERSATIONAL_PATTERNS.some((p) => p.test(trimmed))) return true;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount > 0 && wordCount < 4 && !trimmed.includes('?');
}

function tryParseAction(text) {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Pays for a single registered entry, preferring the reader's own session
 * wallet, falling back to the agent relay wallet, then to a simulated tx hash
 * if neither the contract nor a wallet is configured.
 */
async function payForEntry(db, entry, reader_id) {
  const chainConfigured = process.env.GRIOT_REGISTRY_ADDRESS;
  console.log(`[agent] payForEntry: chainConfigured=${!!chainConfigured} reader_id=${reader_id || '(none)'} canonical_url=${entry.canonical_url}`);

  if (chainConfigured && reader_id) {
    const reader = await db.getReader(reader_id);
    console.log('[agent] payForEntry: reader lookup result:', reader ? { id: reader.id, wallet_id: reader.wallet_id, wallet_address: reader.wallet_address } : null);
    if (!reader) {
      return { success: false, error: 'Reader session not found' };
    }

    const status = await getUsdcStatus(reader.wallet_address).catch((e) => ({ error: e.message }));
    console.log('[agent] payForEntry: reader USDC status (balance/allowance):', status);

    const onChainContent = await getOnChainContent(entry.canonical_url).catch((e) => ({ error: e.message }));
    console.log('[agent] payForEntry: on-chain content state (from contract, not Supabase):', onChainContent);

    const result = await sendContractCall(
      reader.wallet_id,
      getRegistryAddress(),
      'payForCitation(bytes32)',
      [computeContentId(entry.canonical_url)],
    );
    console.log('[agent] payForEntry: sendContractCall result:', result);
    return result.success
      ? { success: true, tx_hash: result.tx_hash, content_id: computeContentId(entry.canonical_url) }
      : { success: false, error: result.error };
  }

  if (chainConfigured) {
    console.log('[agent] payForEntry: no reader_id — falling back to agent relay wallet (dev/testing path)');
    await ensureAgentApproval().catch((e) => console.log('[agent] ensureAgentApproval error:', e.message));
    const result = await payForCitationOnChain(entry.canonical_url);
    console.log('[agent] payForEntry: payForCitationOnChain result:', result);
    return result;
  }

  console.log('[agent] payForEntry: GRIOT_REGISTRY_ADDRESS not configured — simulating');
  // Simulated mode when the contract isn't configured yet.
  return {
    success: true,
    tx_hash: '0x' + crypto.randomBytes(32).toString('hex'),
    content_id: computeContentId(entry.canonical_url),
  };
}

/**
 * Core agent logic, usable outside of an HTTP request (e.g. by the activity
 * bot) as well as by the /api/agent route itself.
 * @param {object} params
 * @param {string} params.query
 * @param {number|string} [params.budget_usdc]
 * @param {object} [params.attachment]
 * @param {string} [params.reader_id]
 * @returns {Promise<{summary: string, citations: Array, total_paid: number}>}
 */
export async function runAgentQuery({ query, budget_usdc, attachment, reader_id }) {
  if (!query) {
    throw new Error('Missing required field: query');
  }

  const budget = parseFloat(budget_usdc) || 0;
  const db = await getDb();

  // Short, purely conversational messages ("thanks", "ok", "hi") skip the
  // whole research loop entirely — no reason to burn a search_registry/
  // web_search call on a pleasantry.
  if (isConversational(query) && !attachment) {
    const reply = await chatCompletion([
      { role: 'system', content: 'You are Griot\'s friendly research assistant. Reply briefly and naturally to this short conversational message — plain text only, no JSON.' },
      { role: 'user', content: query },
    ]);
    return { summary: reply.trim(), citations: [], total_paid: 0 };
  }

  let userText = query;
  if (attachment?.base64) {
    userText += `\n\n[User attached a file named "${attachment.name}" (${attachment.type}) that could not be included directly — ask the user to paste its content as text if you need it.]`;
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText },
  ];

  // Tracks every URL actually fetched during this run, and whether it's a
  // Griot-registered entry — used both to nudge the model and, more
  // importantly, to enforce payment server-side regardless of what the
  // model does or doesn't decide to do.
  const fetchedUrls = new Map(); // url -> registry entry (or null if not registered)
  let hasSearchedRegistry = false;

  async function finalize(summary, modelCitations) {
    console.log('[agent] finalize called with model citations:', modelCitations);
    const citations = [];
    let totalPaid = 0;

    for (const c of modelCitations || []) {
      let normalizedUrl;
      try {
        normalizedUrl = normalizeCanonicalUrl(c.url);
      } catch {
        normalizedUrl = c.url; // not a parseable absolute URL — leave as-is
      }
      const entry = fetchedUrls.get(normalizedUrl) ?? fetchedUrls.get(c.url) ?? await db.findByUrl(normalizedUrl);
      console.log(`[agent] finalize citation check: ${c.url} -> normalized: ${normalizedUrl} -> registered: ${!!entry}`);

      if (!entry) {
        citations.push({ title: c.title, url: c.url, amount_paid: 0, tx_hash: null });
        continue;
      }

      const price = parseFloat(entry.price);
      console.log(`[agent] payment check: price=${price} totalPaid=${totalPaid} budget=${budget} reader_id=${reader_id || '(none)'}`);

      if (totalPaid + price > budget) {
        console.log(`[agent] payment SKIPPED — would exceed budget (${totalPaid} + ${price} > ${budget})`);
        citations.push({ title: c.title, url: c.url, amount_paid: 0, tx_hash: null, note: 'Skipped payment — would exceed budget' });
        continue;
      }

      const payResult = await payForEntry(db, entry, reader_id);
      console.log('[agent] payForEntry result:', payResult);

      if (payResult.success) {
        totalPaid += price;
        citations.push({ title: entry.title || c.title, url: c.url, amount_paid: price, tx_hash: payResult.tx_hash });

        const paymentRecord = await db.recordPayment({
          registry_id: entry.id,
          content_id: payResult.content_id,
          endpoint: '/api/agent',
          payer: reader_id || 'agent',
          creator_wallet: entry.wallet_address,
          amount_usdc: price,
          network: 'arc-testnet',
          gateway_tx: payResult.tx_hash,
        }).catch(e => {
          console.error('[agent] recordPayment FAILED (payment itself still succeeded on-chain):', e.message);
          return null;
        });
        console.log('[agent] recordPayment result:', paymentRecord);
      } else {
        console.log(`[agent] payment FAILED: ${payResult.error}`);
        citations.push({ title: c.title, url: c.url, amount_paid: 0, tx_hash: null, note: `Payment failed: ${payResult.error}` });
      }
    }

    console.log('[agent] final response citations:', citations, 'total_paid:', totalPaid);
    return { summary, citations, total_paid: totalPaid };
  }

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const reply = await chatCompletion(messages);
    console.log(`[agent] turn ${turn} raw reply:`, reply);
    const action = tryParseAction(reply);
    console.log(`[agent] turn ${turn} parsed action:`, action);

    if (!action || !action.action) {
      messages.push({ role: 'assistant', content: reply });
      messages.push({ role: 'user', content: 'Respond with a single valid JSON action object as instructed.' });
      continue;
    }

    messages.push({ role: 'assistant', content: reply });

    if (action.action === 'final') {
      if (!hasSearchedRegistry) {
        messages.push({ role: 'user', content: 'You must call search_registry before finishing, even if you think you already know the answer.' });
        continue;
      }
      return await finalize(action.summary || '', action.citations);
    }

    if (action.action === 'search_registry') {
      hasSearchedRegistry = true;
      const matches = await db.searchRegistry(action.query || query);
      console.log(`[agent] search_registry query="${action.query || query}" matches:`, matches.map(m => ({ title: m.title, canonical_url: m.canonical_url })));

      const result = matches.map(m => {
        fetchedUrls.set(m.canonical_url, m);
        return {
          registry_id: m.id,
          canonical_url: m.canonical_url,
          title: m.title,
          price: m.price,
          mode: m.mode,
          content: (m.content || '').slice(0, 3000),
        };
      });

      messages.push({
        role: 'user',
        content: result.length
          ? `Tool result for search_registry: ${JSON.stringify(result)} — the "content" field above is the ACTUAL full text, already fetched for you. Do not call fetch_content for these — cite them directly using the exact canonical_url given, and write your answer using this content.`
          : `Tool result for search_registry: [] — nothing registered matches this topic. Proceed with web_search for external sources instead.`,
      });
      continue;
    }

    if (action.action === 'web_search') {
      try {
        const result = await webSearch(action.query || query);
        console.log(`[agent] web_search query="${action.query || query}" found ${result.citations.length} sources`);
        messages.push({
          role: 'user',
          content: `Tool result for web_search: ${JSON.stringify(result)} — use fetch_content on whichever of these URLs are most relevant before citing them.`,
        });
      } catch (err) {
        console.log(`[agent] web_search error:`, err.message);
        messages.push({ role: 'user', content: `Tool result for web_search: {"error": "${err.message}"}` });
      }
      continue;
    }

    if (action.action === 'check_registry') {
      let normalizedUrl;
      try {
        normalizedUrl = normalizeCanonicalUrl(action.url);
      } catch {
        normalizedUrl = action.url;
      }
      const entry = await db.findByUrl(normalizedUrl);
      fetchedUrls.set(action.url, entry || null);
      if (entry) fetchedUrls.set(normalizedUrl, entry);
      const result = entry
        ? { registered: true, registry_id: entry.id, price: entry.price, wallet: entry.wallet_address, mode: entry.mode, canonical_url: entry.canonical_url, title: entry.title }
        : { registered: false };
      messages.push({ role: 'user', content: `Tool result for check_registry: ${JSON.stringify(result)}` });
      continue;
    }

    if (action.action === 'fetch_content') {
      try {
        const content = await extractArticle(action.url);
        if (!fetchedUrls.has(action.url)) {
          let normalizedUrl;
          try {
            normalizedUrl = normalizeCanonicalUrl(action.url);
          } catch {
            normalizedUrl = action.url;
          }
          const entry = await db.findByUrl(normalizedUrl);
          fetchedUrls.set(action.url, entry || null);
          if (entry) fetchedUrls.set(normalizedUrl, entry);
          console.log(`[agent] fetch_content: ${action.url} -> normalized: ${normalizedUrl} -> registered: ${!!entry}`);
        }
        messages.push({ role: 'user', content: `Tool result for fetch_content: ${JSON.stringify(content)}` });
      } catch (err) {
        messages.push({ role: 'user', content: `Tool result for fetch_content: {"error": "${err.message}"}` });
      }
      continue;
    }

    messages.push({ role: 'user', content: `Unknown action "${action.action}". Use search_registry, web_search, fetch_content, or final.` });
  }

  // Ran out of turns without a "final" action — return best-effort result,
  // still running fetched registered URLs through the same payment path.
  return await finalize(
    'Reached the maximum number of research steps without a final answer.',
    Array.from(fetchedUrls.entries()).filter(([, entry]) => entry).map(([url, entry]) => ({ title: entry.title, url })),
  );
}

agentRouter.post('/agent', async (req, res) => {
  try {
    const result = await runAgentQuery(req.body);
    res.json(result);
  } catch (err) {
    console.error('[agent] Error:', err.message);
    res.status(err.message?.startsWith('Missing required field') ? 400 : 500).json({ error: err.message });
  }
});
