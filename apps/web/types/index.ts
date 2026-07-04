// Griot frontend types — mirror the backend's documented response shapes.
// Keep this in sync with apps/api once the real backend is live.

export type ContentMode = "paywall" | "citation";

export interface RegistryCheckResponse {
  registered: boolean;
  registry_id?: string;
  price?: number;
  wallet?: string;
  mode?: ContentMode;
  canonical_url?: string;
  title?: string;
}

export interface RegistryEntry {
  id: string;
  content_id: string;
  canonical_url: string;
  price: number;
  mode: ContentMode;
  onchain_tx: string;
}

export interface RegisterContentResponse {
  success: boolean;
  entry: RegistryEntry;
}

export interface RegisterContentInput {
  original_url: string;
  title: string;
  content: string;
  price: number;
  wallet_address: string;
  mode: ContentMode;
  creator_id: string;
}

export interface Creator {
  id: string;
  wallet_address: string;
  username: string;
  created_at: string;
}

export interface RecentPayment {
  tx_hash: string;
  amount_usdc: number;
  created_at: string;
}

export interface CreatorArticle {
  id: string;
  title: string;
  canonical_url: string;
  mode: ContentMode;
  price: number;
  citation_count: number;
  total_earned: number;
  recent_payments: RecentPayment[];
}

export interface CreatorArticlesResponse {
  articles: CreatorArticle[];
  total_earned: number;
  total_citations: number;
}

export interface FetchContentResponse {
  title: string;
  content: string;
  word_count: number;
  source_url: string;
}

export interface AgentCitation {
  title: string;
  url: string;
  amount_paid: number;
  tx_hash: string | null;
}

export interface AgentRunResponse {
  summary: string;
  citations: AgentCitation[];
  total_paid: number;
}

export interface PaymentEvent {
  id: string;
  registry_id: string | null;
  content_id: string;
  endpoint: string;
  payer: string;
  creator_wallet: string;
  amount_usdc: number;
  network: string;
  gateway_tx: string | null;
  created_at: string;
}
