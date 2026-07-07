# Griot

**Get paid every time AI cites your work.**

Griot is a platform where creators register their content and earn USDC automatically the moment an AI research agent reads and cites it — no crypto knowledge required, settled in seconds, with proof for every payment.

Built for the Lepton Hackathon on Arc Testnet.

---

## The problem

AI tools read the open web constantly — summarizing articles, answering questions, citing sources — and the creators behind that content see none of the value being generated. There's no mechanism for a blog post, a technical write-up, or a research thread to get paid when an AI agent uses it.

Griot fixes this with a simple idea: when an AI agent cites your work, you get paid, automatically, on-chain, in seconds.

---

## How it works

**For creators**
1. Sign up with just an email — Griot creates a wallet for you automatically behind the scenes
2. Add your content and set what it's worth per citation
3. Choose how it's used: a paywall (agents pay to read the full piece) or citation royalty (content stays public, agents tip when they cite it)
4. Get paid automatically every time an agent cites you — watch it happen live in your earnings dashboard

**For readers**
1. Sign up with email, fund your session with testnet USDC
2. Chat with the research agent like any AI assistant — ask questions, attach documents or images, ask follow-ups in the same session
3. The agent finds relevant sources, checks Griot's registry, and pays creators directly when it uses their work
4. Every citation shows exactly who got paid, how much, and a transaction hash you can verify on-chain

---

## What's under the hood

- **Arc Testnet** — the settlement layer. Every citation payment is a real, verifiable on-chain transaction with sub-second finality, gas paid in USDC directly
- **GriotRegistry smart contract** — deployed and verified on Arc Testnet, handles content registration and citation payments on-chain (`registerContent()`, `payForCitation()`)
- **Circle programmable wallets** — creators and readers get a wallet the moment they sign up with email, no browser extension, no seed phrase
- **BlockRun + x402** — the research agent's own AI inference is paid for via micropayments on Base, so the entire stack — from the agent's thinking to the creator's payout — runs on pay-per-use rails, not subscriptions
- **Next.js 15 + Supabase** — the frontend and registry/earnings data layer

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, Tailwind CSS v4, Sora + Inter |
| Smart contract | Solidity, deployed via Hardhat to Arc Testnet |
| Backend | Node.js, Express |
| Wallets | Circle Developer-Controlled Wallets |
| Agent inference | BlockRun (x402 payments on Base) |
| Database | Supabase (Postgres + Realtime) |
| Chain | Arc Testnet (chain ID 5042002) |

---

## Contract

GriotRegistry is deployed and verified on Arc Testnet:

```
Address: 0xfa5546B28B8646F8075672e294dAA2F013636F4f
Explorer: https://testnet.arcscan.app/address/0xfa5546B28B8646F8075672e294dAA2F013636F4f
```

Two core functions:
- `registerContent(string canonicalUrl, uint256 price)` — a creator's content and price, written on-chain
- `payForCitation(bytes32 contentId)` — fires when an agent cites a piece of content, moves USDC to the creator, emits a `CitationPaid` event

---

## Running locally

```bash
# Frontend
cd apps/web
npm install
npm run dev

# Backend (separate terminal)
cd apps/api
npm install
npm run dev
```

Environment variables needed are documented in `.env.example` in each app folder.

---

## What's next

- Public registry discovery so any x402-aware agent — not just Griot's own — can find and pay creators
- Mainnet deployment
- Native support for importing X/Twitter threads and Substack posts directly
- A citation-royalty model refined for high-volume public content

---

## Team

Built by Godwin (frontend, product, smart contract) and Toyosi (backend), July 2026.
