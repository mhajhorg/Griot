/**
 * Supabase adapter — wraps the Supabase client with the same
 * interface as memory-db.js so getDb() returns a uniform API.
 */

export function createSupabaseAdapter(supabase) {
  return {
    // Creators
    async findCreatorByWallet(wallet) {
      const { data } = await supabase
        .from('creators')
        .select('*')
        .eq('wallet_address', wallet)
        .maybeSingle();
      return data;
    },

    async findCreatorByEmail(email) {
      const { data } = await supabase
        .from('creators')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      return data;
    },

    async createCreator(wallet, username, email, walletId) {
      const { data, error } = await supabase
        .from('creators')
        .insert({ wallet_address: wallet, username, email, wallet_id: walletId || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getCreator(id) {
      const { data } = await supabase
        .from('creators')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return data;
    },

    // Registry
    async register(entry) {
      const { data, error } = await supabase
        .from('registry')
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async findByUrl(url) {
      const { data } = await supabase
        .from('registry')
        .select('*')
        .eq('canonical_url', url)
        .maybeSingle();
      return data;
    },

    async getRegistryByCreator(creatorId) {
      const { data } = await supabase
        .from('registry')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });
      return data || [];
    },

    async getRegistryById(id) {
      const { data } = await supabase
        .from('registry')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return data;
    },

    async updateRegistryOnchainTx(id, txHash) {
      const { data, error } = await supabase
        .from('registry')
        .update({ onchain_tx: txHash })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // Payments — table is griot_payments (renamed from the original "payments").
    // Insert accepts either the old field names (tx_hash, amount, payer_wallet,
    // verified) from read.js or the new ones (content_id, endpoint, payer,
    // amount_usdc, gateway_tx) from pay.js/agent.js — see the migration for why
    // both sets of columns coexist.
    async recordPayment(p) {
      const { data, error } = await supabase
        .from('griot_payments')
        .insert(p)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getPaymentsByRegistryId(registryId) {
      const { data } = await supabase
        .from('griot_payments')
        .select('*')
        .eq('registry_id', registryId);
      return data || [];
    },

    /**
     * Simple keyword-overlap search over titles — lets the agent discover
     * registered content by topic instead of needing an exact URL up front.
     */
    async searchRegistry(query) {
      const words = (query || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 6);
      if (words.length === 0) return [];

      const orFilter = words.map((w) => `title.ilike.%${w}%`).join(',');
      const { data } = await supabase
        .from('registry')
        .select('*')
        .or(orFilter)
        .limit(10);
      return data || [];
    },

    async getRegistryFeed(limit, offset) {
      const { data } = await supabase
        .from('registry')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      return data || [];
    },

    async getRegistryCount() {
      const { count } = await supabase
        .from('registry')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },

    // Reader sessions
    async createReader(email, walletId, walletAddress) {
      const { data, error } = await supabase
        .from('readers')
        .insert({ email, wallet_id: walletId, wallet_address: walletAddress })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async findReaderByEmail(email) {
      const { data } = await supabase
        .from('readers')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      return data;
    },

    async getReader(id) {
      const { data } = await supabase
        .from('readers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return data;
    },

    async setReaderBudget(id, budget) {
      const { data, error } = await supabase
        .from('readers')
        .update({ budget_usdc: budget })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  };
}
