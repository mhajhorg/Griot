import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../supabase.js';
import { extractArticle } from '../lib/content-extractor.js';
import { chatCompletion } from '../lib/blockrun.js';
import { payForCitationOnChain, ensureAgentApproval, computeContentId, getRegistryAddress } from '../lib/arc.js';
import { sendContractCall } from '../lib/circle.js';

export const agentRouter = Router();

const MAX_TURNS = 6;

// Built as a plain-text ReAct loop (model emits one JSON action per turn) rather
// than relying on native "tool use" / function-calling — BlockRun's free dev-tier
// models (e.g. nvidia/gpt-oss-120b) don't support structured tool calling, and this
// approach works identically whether the model behind BLOCKRUN_MODEL is a free
// model or anthropic/claude-haiku-4-5 for the demo recording.
const SYSTEM_PROMPT = `You are Griot's research agent. You answer the user's query by checking a content
registry, optionally paying a small USDC fee to cite registered content, and fetching public content.

You have a USDC budget for this request. Spend it only when citing registered ("citation" mode) content
genuinely helps answer the query. Free ("paywall" mode without payment, or unregistered) content can be
fetched and cited without paying.

Respond with EXACTLY ONE JSON object per turn, nothing else — no prose, no markdown fences. Valid shapes:
{"action": "check_registry", "url": "..."}
{"action": "fetch_content", "url": "..."}
{"action": "pay", "url": "...", "wallet": "..."}
{"action": "final", "summary": "...", "citations": [{"title": "...", "url": "..."}]}

Call "final" as soon as you can answer the query well. Keep the summary concise and directly answer the query.`;

function tryParseAction(text) {
  try {
    // Strip accidental markdown fences before parsing.
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

agentRouter.post('/agent', async (req, res) => {
  try {
    const { query, budget_usdc, attachment, reader_id } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required field: query' });
    }

    const budget = parseFloat(budget_usdc) || 0;
    const db = await getDb();

    // BlockRun's real chat() interface only accepts a plain text prompt — no
    // documented multimodal content-parts format — so any attachment (image or
    // otherwise) can't be passed through directly. Flag it in the text instead
    // of silently dropping it.
    let userText = query;
    if (attachment?.base64) {
      userText += `\n\n[User attached a file named "${attachment.name}" (${attachment.type}) that could not be included directly — ask the user to paste its content as text if you need it.]`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ];

    let totalPaid = 0;
    const citations = [];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const reply = await chatCompletion(messages);
      const action = tryParseAction(reply);

      if (!action || !action.action) {
        messages.push({ role: 'assistant', content: reply });
        messages.push({ role: 'user', content: 'Respond with a single valid JSON action object as instructed.' });
        continue;
      }

      messages.push({ role: 'assistant', content: reply });

      if (action.action === 'final') {
        return res.json({
          summary: action.summary || '',
          citations: action.citations?.length ? action.citations.map(c => ({
            title: c.title,
            url: c.url,
            amount_paid: citations.find(p => p.url === c.url)?.amount_paid ?? 0,
            tx_hash: citations.find(p => p.url === c.url)?.tx_hash ?? null,
          })) : citations,
          total_paid: totalPaid,
        });
      }

      if (action.action === 'check_registry') {
        const entry = await db.findByUrl(action.url);
        const result = entry
          ? { registered: true, registry_id: entry.id, price: entry.price, wallet: entry.wallet_address, mode: entry.mode, canonical_url: entry.canonical_url, title: entry.title }
          : { registered: false };
        messages.push({ role: 'user', content: `Tool result for check_registry: ${JSON.stringify(result)}` });
        continue;
      }

      if (action.action === 'fetch_content') {
        try {
          const content = await extractArticle(action.url);
          messages.push({ role: 'user', content: `Tool result for fetch_content: ${JSON.stringify(content)}` });
        } catch (err) {
          messages.push({ role: 'user', content: `Tool result for fetch_content: {"error": "${err.message}"}` });
        }
        continue;
      }

      if (action.action === 'pay') {
        const entry = await db.findByUrl(action.url);
        if (!entry) {
          messages.push({ role: 'user', content: `Tool result for pay: {"error": "URL not registered"}` });
          continue;
        }

        const price = parseFloat(entry.price);
        if (totalPaid + price > budget) {
          messages.push({ role: 'user', content: `Tool result for pay: {"error": "Payment would exceed remaining budget"}` });
          continue;
        }

        let payResult;
        const chainConfigured = process.env.GRIOT_REGISTRY_ADDRESS;

        if (chainConfigured && reader_id) {
          // Preferred path: pay from the READER'S OWN session wallet, so funds
          // actually come out of their approved allowance, not an agent relay wallet.
          const db2 = await getDb();
          const reader = await db2.getReader(reader_id);
          if (!reader) {
            messages.push({ role: 'user', content: `Tool result for pay: {"error": "Reader session not found"}` });
            continue;
          }
          const data = await sendContractCall(
            reader.wallet_id,
            getRegistryAddress(),
            'payForCitation(bytes32)',
            [computeContentId(entry.canonical_url)],
          );
          payResult = data.success
            ? { success: true, tx_hash: data.tx_hash, content_id: computeContentId(entry.canonical_url) }
            : { success: false, error: data.error };
        } else if (chainConfigured) {
          // Fallback: no reader session provided (e.g. local testing) — pay from
          // the agent relay wallet instead. Only fine for dev/testing since this
          // is not real reader-funded payment.
          await ensureAgentApproval().catch(() => {});
          payResult = await payForCitationOnChain(entry.canonical_url);
        } else {
          // Simulated mode when the contract/agent wallet isn't configured yet.
          payResult = {
            success: true,
            tx_hash: '0x' + crypto.randomBytes(32).toString('hex'),
            content_id: computeContentId(entry.canonical_url),
          };
        }

        if (payResult.success) {
          totalPaid += price;
          citations.push({ title: entry.title, url: action.url, amount_paid: price, tx_hash: payResult.tx_hash });

          await db.recordPayment({
            registry_id: entry.id,
            content_id: payResult.content_id,
            endpoint: '/api/agent',
            payer: reader_id || 'agent',
            creator_wallet: entry.wallet_address,
            amount_usdc: price,
            network: 'arc-testnet',
            gateway_tx: payResult.tx_hash,
          }).catch(e => console.error('[agent] Failed to record payment:', e.message));
        }

        messages.push({ role: 'user', content: `Tool result for pay: ${JSON.stringify(payResult)}` });
        continue;
      }

      messages.push({ role: 'user', content: `Unknown action "${action.action}". Use check_registry, fetch_content, pay, or final.` });
    }

    // Ran out of turns without a "final" action — return best-effort result.
    res.json({
      summary: 'Reached the maximum number of research steps without a final answer.',
      citations,
      total_paid: totalPaid,
    });
  } catch (err) {
    console.error('[agent] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
