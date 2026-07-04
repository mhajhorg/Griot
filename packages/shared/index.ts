// Griot shared types and constants

// Arc Testnet config
export const ARC_CONFIG = {
  rpcUrl: "https://rpc.testnet.arc.network",
  chainId: 5042002,
  usdcAddress: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`,
  network: "eip155:5042002",
}

// Registry entry — stored in Supabase
export interface RegistryEntry {
  id: string
  creator_id: string
  original_url: string
  canonical_url: string
  title: string
  content: string
  price: number          // in USDC e.g. 0.02
  wallet_address: string
  mode: "paywall" | "citation"
  citation_count: number
  total_earned: number
  created_at: string
}

// Creator profile
export interface Creator {
  id: string
  wallet_address: string
  username: string
  created_at: string
}

// Payment event — recorded after each settled x402 payment
export interface PaymentEvent {
  id: string
  registry_id: string
  endpoint: string
  payer: string
  amount_usdc: string
  network: string
  gateway_tx: string | null
  created_at: string
}

// Agent citation — what gets shown in reader output
export interface Citation {
  url: string
  title: string
  creator_username: string
  amount_paid: number
  tx_hash: string
  excerpt: string
}

// Agent research output
export interface ResearchOutput {
  query: string
  summary: string
  citations: Citation[]
  total_paid: number
  created_at: string
}

// API response shapes
export interface CheckRegistryResponse {
  registered: boolean
  price?: number
  wallet?: string
  mode?: "paywall" | "citation"
  canonical_url?: string
  registry_id?: string
}

export interface PayResponse {
  success: boolean
  tx_hash: string
  amount_usdc: number
  creator_wallet: string
}

export interface FetchContentResponse {
  title: string
  content: string
  word_count: number
  source_url: string
}
