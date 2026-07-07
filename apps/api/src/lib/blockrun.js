/**
 * BlockRun LLM client wrapper.
 *
 * IMPORTANT: BlockRun does not use a normal Bearer API key — it uses the x402
 * protocol, where a wallet private key signs a small USDC payment per request.
 * The official @blockrun/llm SDK handles that signing for you.
 *
 * client.chatCompletion(model, messages) is the SDK's real multi-turn method —
 * takes a normal { role, content }[] messages array and returns
 * result.choices[0].message.content, same shape as OpenAI. No separate
 * "testnet client" exists — for cost-free local dev, just keep calling one of
 * BlockRun's free NVIDIA-hosted models (see below); it's $0 regardless of
 * whether your wallet ever holds real USDC.
 *
 * Environment variables:
 *   BLOCKRUN_WALLET_KEY   - Base wallet private key, bridged to BASE_CHAIN_WALLET_KEY
 *                           (the SDK's own env var name). Still required even for
 *                           free models — it signs the (zero-cost) request.
 *   BLOCKRUN_MODEL        - defaults to "nvidia/gpt-oss-120b", a free model —
 *                           safe to leave as-is for dev. Swap to a paid model
 *                           (e.g. "anthropic/claude-haiku-4.5") for production/demo,
 *                           and make sure the wallet holds real USDC on Base first.
 */

import { LLMClient } from '@blockrun/llm';

let _client;
function getClient() {
  if (!_client) {
    const privateKey = process.env.BLOCKRUN_WALLET_KEY;
    if (!process.env.BASE_CHAIN_WALLET_KEY && privateKey) {
      process.env.BASE_CHAIN_WALLET_KEY = privateKey;
    }
    _client = new LLMClient();
  }
  return _client;
}

/**
 * Multi-turn chat completion.
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} [opts]
 * @param {string} [opts.model] - defaults to BLOCKRUN_MODEL env var (free model by default)
 * @returns {Promise<string>} the assistant's text reply
 */
export async function chatCompletion(messages, opts = {}) {
  const client = getClient();
  const model = opts.model || process.env.BLOCKRUN_MODEL || 'nvidia/gpt-oss-120b';

  const result = await client.chatCompletion(model, messages);
  return result.choices?.[0]?.message?.content ?? '';
}
