/**
 * In-memory storage fallback when Supabase is not configured.
 * Mirrors the same interface so registry/read/pay/agent all work without a DB.
 */

const creators = new Map();
const registry = new Map();
const payments = new Map();
const readers = new Map();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export const db = {
  // Creators
  async findCreatorByWallet(wallet) {
    for (const c of creators.values()) {
      if (c.wallet_address === wallet) return c;
    }
    return null;
  },

  async findCreatorByEmail(email) {
    for (const c of creators.values()) {
      if (c.email === email) return c;
    }
    return null;
  },

  async createCreator(wallet, username, email, walletId) {
    const existing = await this.findCreatorByWallet(wallet);
    if (existing) return existing;

    const creator = {
      id: uuid(),
      wallet_address: wallet,
      username,
      email,
      wallet_id: walletId || null,
      created_at: new Date().toISOString(),
    };
    creators.set(creator.id, creator);
    return creator;
  },

  async getCreator(id) {
    return creators.get(id) || null;
  },

  // Registry
  async register(entry) {
    const existing = await this.findByUrl(entry.canonical_url);
    if (existing) throw Object.assign(new Error('URL already registered'), { code: '23505' });

    const record = {
      id: uuid(),
      creator_id: entry.creator_id,
      original_url: entry.original_url,
      canonical_url: entry.canonical_url,
      content_id: entry.content_id || null,
      title: entry.title || null,
      content: entry.content || null,
      price: parseFloat(entry.price),
      wallet_address: entry.wallet_address,
      mode: entry.mode,
      created_at: new Date().toISOString(),
    };
    registry.set(record.id, record);
    return record;
  },

  async findByUrl(url) {
    for (const r of registry.values()) {
      if (r.canonical_url === url) return r;
    }
    return null;
  },

  async getRegistryByCreator(creatorId) {
    const results = [];
    for (const r of registry.values()) {
      if (r.creator_id === creatorId) results.push(r);
    }
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getRegistryById(id) {
    return registry.get(id) || null;
  },

  async updateRegistryOnchainTx(id, txHash) {
    const record = registry.get(id);
    if (record) record.onchain_tx = txHash;
    return record || null;
  },

  // Payments — accepts either the old shape (tx_hash, amount, payer_wallet, verified)
  // used by read.js, or the new shape (content_id, endpoint, payer, amount_usdc,
  // gateway_tx) used by pay.js/agent.js. Stored as-is so either reader can find its
  // own field names on the record later.
  async recordPayment(p) {
    const record = {
      id: uuid(),
      registry_id: p.registry_id,
      created_at: new Date().toISOString(),
      ...p,
    };
    payments.set(record.id, record);
    return record;
  },

  getPaymentsByRegistryId(registryId) {
    const results = [];
    for (const p of payments.values()) {
      if (p.registry_id === registryId) results.push(p);
    }
    return results;
  },

  /**
   * Simple keyword-overlap search over titles/URLs — lets the agent discover
   * registered content by topic instead of needing an exact URL up front.
   */
  async searchRegistry(query) {
    const words = (query || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) return [];

    const scored = [];
    for (const r of registry.values()) {
      const haystack = `${r.title || ''} ${r.canonical_url || ''}`.toLowerCase();
      const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
      if (score > 0) scored.push({ entry: r, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 10).map((s) => s.entry);
  },

  async getRegistryFeed(limit, offset) {
    const all = Array.from(registry.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return all.slice(offset, offset + limit);
  },

  async getRegistryCount() {
    return registry.size;
  },

  async getPlatformStats() {
    return {
      creator_count: creators.size,
      article_count: registry.size,
      citation_count: payments.size,
    };
  },

  // Reader sessions
  async createReader(email, walletId, walletAddress) {
    const reader = {
      id: uuid(),
      email,
      wallet_id: walletId,
      wallet_address: walletAddress,
      budget_usdc: null,
      created_at: new Date().toISOString(),
    };
    readers.set(reader.id, reader);
    return reader;
  },

  async findReaderByEmail(email) {
    for (const r of readers.values()) {
      if (r.email === email) return r;
    }
    return null;
  },

  async getReader(id) {
    return readers.get(id) || null;
  },

  async setReaderBudget(id, budget) {
    const reader = readers.get(id);
    if (reader) reader.budget_usdc = budget;
    return reader;
  },
};
