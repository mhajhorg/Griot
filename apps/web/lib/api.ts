import type {
  RegistryCheckResponse,
  RegisterContentResponse,
  RegisterContentInput,
  Creator,
  CreatorArticlesResponse,
  FetchContentResponse,
  AgentRunResponse,
  ReaderSession,
  ReaderBalance,
  ReaderApproveResponse,
} from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Flip to false once the real backend endpoint is confirmed live.
// Can also be swapped per-function if you want to migrate one endpoint at a time.
export const USE_MOCK = true;

// ---------- mock helpers ----------

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number) {
  return delay(min + Math.random() * (max - min));
}

function fakeTxHash(): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 64; i++) {
    out += hex[Math.floor(Math.random() * hex.length)];
  }
  return out;
}

function fakeWallet(): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    out += hex[Math.floor(Math.random() * hex.length)];
  }
  return out;
}

const MOCK_TITLES = [
  "Why Arc Network changes the nanopayments game",
  "x402 explained: HTTP payments for AI agents",
  "How Circle's programmable wallets actually work",
  "The agentic web needs a payment standard",
  "Citation royalties: a new model for creator income",
  "Building on Arc Testnet: a practical guide",
  "What AI agents owe the creators they cite",
];

function randomTitle(): string {
  return MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
}

function randomPrice(): number {
  // $0.005 - $0.05, rounded to 3 decimals
  return Math.round((0.005 + Math.random() * 0.045) * 1000) / 1000;
}

// In-memory mock registry — stores full content so the public article page
// can render real registered articles within a session, and tracks live
// citation stats so the creator/reader/earnings flow forms a real closed
// loop instead of three disconnected random generators.
interface MockRegistryEntry {
  registry_id: string;
  creator_id: string;
  price: number;
  wallet: string;
  mode: "paywall" | "citation";
  canonical_url: string;
  title: string;
  content: string;
  citation_count: number;
  total_earned: number;
  recent_payments: { tx_hash: string; amount_usdc: number; created_at: string }[];
}

const MOCK_REGISTRY_STORAGE_KEY = "griot_mock_registry";
const mockRegistry = new Map<string, MockRegistryEntry>();

// Returns the unique underlying entries (dedupes the 3 lookup keys per entry
// that all point to the same object).
function uniqueMockEntries(): MockRegistryEntry[] {
  return Array.from(new Set(mockRegistry.values()));
}

// ---------- registry ----------

export async function checkRegistry(url: string): Promise<RegistryCheckResponse> {
  if (USE_MOCK) {
    await randomDelay(200, 500);
    const hit = mockRegistry.get(url);
    if (hit) {
      return {
        registered: true,
        registry_id: hit.registry_id,
        price: hit.price,
        wallet: hit.wallet,
        mode: hit.mode,
        canonical_url: hit.canonical_url,
        title: hit.title,
      };
    }
    return { registered: false };
  }
  return fetchJSON<RegistryCheckResponse>(`${API}/api/registry/check?url=${encodeURIComponent(url)}`);
}

/**
 * Looks up a registered article by its /read/[slug] path.
 * BACKEND TODO: implement GET /api/articles/:slug (no auth required).
 * Returns { title, content, price, mode } for a given canonical_url slug.
 */
export async function getArticleBySlug(
  slug: string
): Promise<{ title: string; content: string; price: number; mode: "paywall" | "citation" } | null> {
  if (USE_MOCK) {
    await randomDelay(200, 500);
    const hit = mockRegistry.get(`/read/${slug}`);
    if (!hit) return null;
    return { title: hit.title, content: hit.content, price: hit.price, mode: hit.mode };
  }
  const res = await fetch(`${API}/api/articles/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

export async function registerContent(
  input: RegisterContentInput
): Promise<RegisterContentResponse> {
  if (USE_MOCK) {
    await randomDelay(600, 1200);
    const timestamp = Date.now();
    const slug =
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) + `-${timestamp}`;
    const canonical_url = `https://griot.xyz/read/${slug}`;
    const registry_id = `mock-${timestamp}`;
    const content_id = fakeTxHash().slice(0, 42);
    const onchain_tx = fakeTxHash(); // generated once, stored, and reused below —
    // not regenerated, so the "view on ArcScan" link stays valid and consistent

    const entry: MockRegistryEntry = {
      registry_id,
      creator_id: input.creator_id,
      price: input.price,
      wallet: input.wallet_address,
      mode: input.mode,
      canonical_url,
      title: input.title,
      content: input.content,
      citation_count: 0,
      total_earned: 0,
      recent_payments: [],
    };

    mockRegistry.set(input.original_url, entry);
    mockRegistry.set(canonical_url, entry);
    mockRegistry.set(`/read/${slug}`, entry); // local route lookup key
    saveMockRegistryToStorage();

    return {
      success: true,
      entry: {
        id: registry_id,
        content_id,
        canonical_url,
        price: input.price,
        mode: input.mode,
        onchain_tx,
      },
    };
  }

  return fetchJSON<RegisterContentResponse>(`${API}/api/registry/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function upsertCreator(
  wallet_address: string,
  username: string
): Promise<Creator> {
  if (USE_MOCK) {
    await randomDelay(300, 700);
    return {
      id: `mock-creator-${wallet_address.slice(2, 10)}`,
      wallet_address,
      username,
      created_at: new Date().toISOString(),
    };
  }
  return fetchJSON<Creator>(`${API}/api/registry/creator`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address, username }),
  });
}

/**
 * Email-first signup path — no wallet required from the creator.
 * BACKEND TODO: POST /api/registry/creator/email-signup
 *   Body: { email: string, username: string }
 *   Returns: { id, wallet_address, username, created_at }
 * Implementation should:
 *   1. Create creator record keyed by email
 *   2. Provision a custodial wallet (Circle or Turnkey) invisibly
 *   3. Store the generated wallet_address against the creator record
 *   4. Return the standard Creator shape — frontend never needs to know
 *      whether the wallet was connected or invisibly created
 */
export async function signUpWithEmail(
  email: string,
  username: string
): Promise<Creator> {
  if (USE_MOCK) {
    await randomDelay(900, 1600); // provisioning a wallet takes a moment
    return {
      id: `mock-creator-${email.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`,
      wallet_address: fakeWallet(),
      username,
      created_at: new Date().toISOString(),
    };
  }
  const result = await fetchJSON<Creator>(`${API}/api/registry/creator/email-signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username }),
  });
  // Guarantee the username is never lost even if the backend's response
  // omits it or names the field differently — we already know it locally
  // since the person just typed it into the signup form.
  return { ...result, username: result.username || username };
}

export async function getCreatorArticles(
  creatorId: string
): Promise<CreatorArticlesResponse> {
  if (USE_MOCK) {
    await randomDelay(400, 900);

    // Return this creator's actually-registered content with real,
    // accumulated citation/earnings data — not random filler. A creator
    // with nothing registered yet correctly sees an empty dashboard.
    const articles = uniqueMockEntries()
      .filter((e) => e.creator_id === creatorId)
      .map((e) => ({
        id: e.registry_id,
        title: e.title,
        canonical_url: e.canonical_url,
        mode: e.mode,
        price: e.price,
        citation_count: e.citation_count,
        total_earned: Math.round(e.total_earned * 1000) / 1000,
        recent_payments: e.recent_payments.slice(0, 5),
      }));

    return {
      articles,
      total_earned: Math.round(articles.reduce((sum, a) => sum + a.total_earned, 0) * 1000) / 1000,
      total_citations: articles.reduce((sum, a) => sum + a.citation_count, 0),
    };
  }

  return fetchJSON<CreatorArticlesResponse>(`${API}/api/registry/creator/${creatorId}`);
}

// ---------- content ----------

export async function fetchContent(url: string): Promise<FetchContentResponse> {
  if (USE_MOCK) {
    await randomDelay(800, 1800);
    return {
      title: randomTitle(),
      content:
        "This is mock fetched content standing in for the real article body. " +
        "Once the backend's /api/fetch-content endpoint is live, this will be " +
        "the actual extracted text from the URL you pasted. Edit this field " +
        "freely before registering — creators are expected to review and " +
        "expand on imported content rather than publish it verbatim.",
      word_count: 312,
      source_url: url,
    };
  }

  return fetchJSON<FetchContentResponse>(`${API}/api/fetch-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

// ---------- agent ----------

// Short conversational messages a real agent would answer without searching.
// Matches "thanks", "ok", "cool", "got it", short replies under 8 words, etc.
const CONVERSATIONAL_PATTERNS = [
  /^(thanks|thank you|thx|ty|cheers|ok|okay|cool|got it|makes sense|great|nice|perfect|awesome|sure|alright|sounds good|i see|interesting|noted|understood|no problem|np|yes|no|yep|nope|right|correct|exactly)[.!?]?$/i,
];

function isConversational(query: string): boolean {
  const trimmed = query.trim();
  if (CONVERSATIONAL_PATTERNS.some((p) => p.test(trimmed))) return true;
  // Also treat very short messages (under 4 words) that aren't questions as conversational
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount < 4 && !trimmed.includes("?");
}

// Finds registered content whose title shares a distinctive word (4+
// characters) with the query — a simple stand-in for the real agent's
// semantic search, good enough to make the demo feel like a real loop:
// register something, ask about it using its own words, get cited for real.
function findMatchingRegisteredContent(query: string): MockRegistryEntry[] {
  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  if (queryWords.length === 0) return [];

  return uniqueMockEntries().filter((entry) => {
    const titleWords = entry.title.toLowerCase().split(/\s+/);
    return queryWords.some((qw) => titleWords.some((tw) => tw.includes(qw) || qw.includes(tw)));
  });
}

export async function runAgent(
  query: string,
  budgetUsdc: number = 0.5,
  attachment?: { name: string; type: string; base64: string },
  readerId?: string
): Promise<AgentRunResponse> {
  if (USE_MOCK) {
    // Conversational messages get a plain reply with no citations and no spend
    if (isConversational(query) && !attachment) {
      await randomDelay(600, 1000);
      const replies: Record<string, string> = {
        default: "Happy to keep going — what would you like to explore next?",
        thanks: "You're welcome! Ask me anything else.",
        ok: "Got it. What else would you like to know?",
        yes: "Great. What's your next question?",
        no: "No problem. What else can I help you research?",
      };
      const key = query.trim().toLowerCase().replace(/[.!?]$/, "");
      const summary = replies[key] ?? replies.default;
      return { summary, citations: [], total_paid: 0 };
    }

    await randomDelay(2600, 3400);

    let remainingBudget = budgetUsdc;
    const citations: AgentRunResponse["citations"] = [];

    // Real match first: cite actually-registered content and update its
    // live stats so the earnings dashboard reflects a genuine event.
    const matches = findMatchingRegisteredContent(query);
    for (const entry of matches) {
      if (entry.price > remainingBudget) continue;
      const txHash = fakeTxHash();
      remainingBudget = Math.round((remainingBudget - entry.price) * 1000) / 1000;

      entry.citation_count += 1;
      entry.total_earned = Math.round((entry.total_earned + entry.price) * 1000) / 1000;
      entry.recent_payments.unshift({
        tx_hash: txHash,
        amount_usdc: entry.price,
        created_at: new Date().toISOString(),
      });

      citations.push({
        title: entry.title,
        url: entry.canonical_url,
        amount_paid: entry.price,
        tx_hash: txHash,
      });
    }

    // Fill remaining slots with generic filler citations, same as before,
    // so a query unrelated to anything registered still demos smoothly.
    const fillerCount = Math.max(0, 1 + Math.floor(Math.random() * 2) - citations.length);
    for (let i = 0; i < fillerCount; i++) {
      const price = randomPrice();
      const isFree = Math.random() < 0.25 || price > remainingBudget;
      if (!isFree) remainingBudget = Math.round((remainingBudget - price) * 1000) / 1000;

      citations.push({
        title: randomTitle(),
        url: `https://griot.xyz/read/source-${i}-${Date.now()}`,
        amount_paid: isFree ? 0 : price,
        tx_hash: isFree ? null : fakeTxHash(),
      });
    }

    const totalPaid =
      Math.round(citations.reduce((sum, c) => sum + c.amount_paid, 0) * 1000) / 1000;

    return {
      summary: `Researching "${query}": Arc Network settles USDC transfers with sub-second finality and pays gas in USDC directly rather than a separate native token [1]. Payments routed through the x402 protocol mean an AI agent can pay for content autonomously, mid-request, without a human approving each transaction [2]. This is the foundation Griot builds its citation-payment model on top of.`,
      citations,
      total_paid: totalPaid,
    };
  }

  return fetchJSON<AgentRunResponse>(`${API}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, budget_usdc: budgetUsdc, attachment, reader_id: readerId }),
  });
  return res.json();
}

// ---------- reader identity (Circle-managed reader wallet, email login) ----------

/**
 * Logs a reader in by email. First-time email creates a new wallet
 * (is_new: true); returning email finds the existing wallet and whatever
 * balance is left on it (is_new: false). Same reader_id/wallet_address
 * either way — cache reader_id in localStorage so returning visitors don't
 * have to re-enter their email every single page load, just once per login.
 */
export async function readerLogin(email: string): Promise<ReaderSession> {
  if (USE_MOCK) {
    await randomDelay(500, 900);
    // Simulate "returning reader" behavior in mock mode: same email always
    // gets the same fake reader_id/wallet within a session, marked is_new
    // only the first time it's seen in this browser tab.
    const key = `mock-reader-seen-${email.toLowerCase()}`;
    const alreadySeen = typeof window !== "undefined" && window.sessionStorage.getItem(key);
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
    return {
      reader_id: `mock-reader-${email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
      wallet_address: fakeWallet(),
      is_new: !alreadySeen,
    };
  }
  const res = await fetch(`${API}/api/reader/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

/**
 * Poll this while waiting for a reader's deposit to land, or just to check
 * what's left on a returning reader's wallet.
 */
export async function getReaderBalance(readerId: string): Promise<ReaderBalance> {
  if (USE_MOCK) {
    await randomDelay(200, 400);
    // Mock always reports a healthy balance so the flow is testable end to end
    return { wallet_address: fakeWallet(), usdc_balance: 5.0 };
  }
  const res = await fetch(`${API}/api/reader/${readerId}/balance`);
  return res.json();
}

/**
 * Call once, after the reader's wallet is funded and before starting a
 * chat session. Silently signs the on-chain approval — no wallet popup,
 * since this is a backend-managed Circle wallet.
 */
export async function approveReaderBudget(
  readerId: string,
  budgetUsdc: number
): Promise<ReaderApproveResponse> {
  if (USE_MOCK) {
    await randomDelay(800, 1400);
    return { success: true, tx_hash: fakeTxHash() };
  }
  const res = await fetch(`${API}/api/reader/${readerId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budget_usdc: budgetUsdc }),
  });
}

/**
 * BACKEND TODO: POST /api/creator/withdraw
 *   Body: { from_wallet: string, to_address: string, amount: number }
 *   Returns: { success: boolean, tx_hash: string }
 * Implementation should initiate a USDC transfer from the creator's
 * custodial wallet (Circle or Turnkey) to the destination address on Arc.
 */
export async function withdrawEarnings(
  fromWallet: string,
  toAddress: string,
  amount: number
): Promise<{ success: boolean; tx_hash: string }> {
  if (USE_MOCK) {
    await randomDelay(1200, 2000);
    return {
      success: true,
      tx_hash: fakeTxHash(),
    };
  }

  return fetchJSON<{ success: boolean; tx_hash: string }>(`${API}/api/creator/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_wallet: fromWallet, to_address: toAddress, amount }),
  });
}
