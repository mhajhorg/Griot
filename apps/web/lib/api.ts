import type {
  RegistryCheckResponse,
  RegisterContentResponse,
  RegisterContentInput,
  Creator,
  CreatorArticlesResponse,
  FetchContentResponse,
  AgentRunResponse,
} from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Flip to false once the real backend endpoint is confirmed live.
// Can also be swapped per-function if you want to migrate one endpoint at a time.
const USE_MOCK = true;

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
// can render real registered articles within a session.
interface MockRegistryEntry {
  registry_id: string;
  price: number;
  wallet: string;
  mode: "paywall" | "citation";
  canonical_url: string;
  title: string;
  content: string;
}
const mockRegistry = new Map<string, MockRegistryEntry>();

// ---------- registry ----------

export async function checkRegistry(url: string): Promise<RegistryCheckResponse> {
  if (USE_MOCK) {
    await randomDelay(200, 500);
    const hit = mockRegistry.get(url);
    if (hit) {
      const { content: _content, ...rest } = hit;
      return { registered: true, ...rest };
    }
    return { registered: false };
  }
  const res = await fetch(`${API}/api/registry/check?url=${encodeURIComponent(url)}`);
  return res.json();
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

    const entry: MockRegistryEntry = {
      registry_id,
      price: input.price,
      wallet: input.wallet_address,
      mode: input.mode,
      canonical_url,
      title: input.title,
      content: input.content,
    };

    mockRegistry.set(input.original_url, entry);
    mockRegistry.set(canonical_url, entry);
    mockRegistry.set(`/read/${slug}`, entry); // local route lookup key

    return {
      success: true,
      entry: {
        id: registry_id,
        content_id,
        canonical_url,
        price: input.price,
        mode: input.mode,
        onchain_tx: fakeTxHash(),
      },
    };
  }

  const res = await fetch(`${API}/api/registry/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
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
  const res = await fetch(`${API}/api/registry/creator`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address, username }),
  });
  return res.json();
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
  const res = await fetch(`${API}/api/registry/creator/email-signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username }),
  });
  return res.json();
}

export async function getCreatorArticles(
  creatorId: string
): Promise<CreatorArticlesResponse> {
  if (USE_MOCK) {
    await randomDelay(400, 900);

    const articleCount = 2 + Math.floor(Math.random() * 3); // 2-4 articles
    const articles = Array.from({ length: articleCount }, (_, i) => {
      const citationCount = Math.floor(Math.random() * 80);
      const price = randomPrice();
      const totalEarned = Math.round(citationCount * price * 1000) / 1000;
      const paymentCount = Math.min(citationCount, 3);

      return {
        id: `${creatorId}-article-${i}`,
        title: randomTitle(),
        canonical_url: `https://griot.xyz/read/article-${i}-${creatorId.slice(-6)}`,
        mode: (i % 2 === 0 ? "paywall" : "citation") as "paywall" | "citation",
        price,
        citation_count: citationCount,
        total_earned: totalEarned,
        recent_payments: Array.from({ length: paymentCount }, (_, j) => ({
          tx_hash: fakeTxHash(),
          amount_usdc: price,
          created_at: new Date(Date.now() - j * 1000 * 60 * (5 + j * 12)).toISOString(),
        })),
      };
    });

    return {
      articles,
      total_earned: Math.round(articles.reduce((sum, a) => sum + a.total_earned, 0) * 1000) / 1000,
      total_citations: articles.reduce((sum, a) => sum + a.citation_count, 0),
    };
  }

  const res = await fetch(`${API}/api/registry/creator/${creatorId}`);
  return res.json();
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

  const res = await fetch(`${API}/api/fetch-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
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

export async function runAgent(
  query: string,
  budgetUsdc: number = 0.5,
  attachment?: { name: string; type: string; base64: string }
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

    const citationCount = 1 + Math.floor(Math.random() * 3);
    let remainingBudget = budgetUsdc;
    const citations = [];

    for (let i = 0; i < citationCount; i++) {
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

  const res = await fetch(`${API}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, budget_usdc: budgetUsdc, attachment }),
  });
  return res.json();
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

  const res = await fetch(`${API}/api/creator/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_wallet: fromWallet, to_address: toAddress, amount }),
  });
  return res.json();
}
