# Monetization Agents & the Cloudflare Monetization Gateway — Research Brief

*Part 5 of the ATProto content-sites research.* Grounded in Cloudflare's Monetization Gateway announcement, x402 protocol spec/coverage, Interledger/Web Monetization, and Pay Per Crawl / Pay Per Use reporting.

---

## The missing eighth agent role: monetization

Parts 1–4 identified seven operational agent roles for a content publisher:

- Distribution — publish signed records to PDS + generate RSS/ActivityPub/Bluesky/email/push derivatives
- Cross-network moderation — unify onsite + ATProto + ActivityPub comments; emit composable labels
- Feed curation — run custom feed generators for the publisher's vertical
- Entitlements — manage paywall/subscriptions (keep publisher-side; never put premium content in public records)
- Rights/syndication — track reuse across firehose/RSS/partner domains, build evidence packages
- Analytics — first-party + protocol data
- Provenance — C2PA signing, content credentials in article records

There is an eighth: **monetization** — and Cloudflare's Monetization Gateway (announced July 2026) is the piece that makes it concrete, especially for agent-mediated consumption. The thesis of this brief: the publisher's stack postulated in Parts 1–4 (PDS public records + private sidecar + RSS previews + MCP server + App Intents + on-device personalization) is incomplete without a payment layer designed for a world where the consumer of content may be an **agent acting on a user's behalf**, not a human clicking a paywall button.

---

## 1. The economic problem Cloudflare names

From the [Monetization Gateway announcement](https://blog.cloudflare.com/monetization-gateway/):

> "For 30 years, the web has run on a simple economic bargain: trading content for human attention. That attention has been monetized through advertising, subscriptions, and e-commerce. This bargain funded the Internet as we know it. **But as agents become the dominant Internet users, the model is breaking.** An agent does not look at ads or need to maintain a monthly subscription to all the tools it wants to access. It reads a page or consumes a data feed once, takes what it needs, and moves on. Across the web, AI crawlers already request content anywhere from a hundred to tens of thousands of times for every visitor they send back."

> "This reality demands a new model: **usage-based pricing for everything.** If attention and e-commerce are moving from websites to AI harnesses and AI-written software, then agents should pay for the inputs they need — training data, inference content, developer tooling, and API usage. The natural unit of payment for software is the request, the token, or the outcome, not the seat or the month."

The core insight: the three legacy web monetization models — advertising (needs human attention), subscriptions (needs pre-existing account relationship), e-commerce (needs a human checkout) — all assume a **human** consumer. Agents break all three. A new model — **pay-per-request**, priced in fractions of a cent, settled instantly — is needed for machine consumption.

---

## 2. x402 — the HTTP-native payment protocol

### What it is
[x402](https://x402.org/) is an open payment protocol that finally puts the HTTP 402 "Payment Required" status code (reserved since 1991, never standardized) to work. Developed by Coinbase, co-governed by the x402 Foundation (co-founded with Cloudflare), backed by 25+ industry leaders. ([x402.org](https://x402.org/); [Sherlock analysis](https://sherlock.xyz/post/x402-explained-the-http-402-payment-protocol); [allium.so](https://www.allium.so/blog/x402-explained-the-internet-native-payments-standard-for-apis-data-and-agent-commerce/))

### How it works (the 4-step request/response cycle)
1. **Client requests a payment-gated resource** (e.g., an agent fetches a publisher's article URL or MCP tool).
2. **Server responds with 402 Payment Required** + a payload stating: the price, the accepted asset (e.g., USDC stablecoin), and where to pay.
3. **Client pays** — signs a stablecoin transaction, attaches proof of payment to the request, and retries.
4. **Server (or facilitator) verifies payment** and returns the resource (200 OK).

All of this happens **inside ordinary HTTP requests and responses** — no redirect to a checkout page, no separate payment API, no account creation, no API key. Settlement is peer-to-peer (funds go directly to the seller's wallet). Target: sub-second settlement, negligible fees. ([Cloudflare blog](https://blog.cloudflare.com/monetization-gateway/); [devtoollab.com](https://devtoollab.com/blog/x402-ai-agent-payments-guide); [stablecoininsider.org](https://stablecoininsider.org/x402-protocol/))

### Why stablecoins
Stablecoins (USDC, Open USD) enable sub-cent micropayments with sub-second settlement — impossible on traditional payment rails (credit card minimums, settlement delays, chargeback risk). Layer 2 blockchains (Base, Solana) brought settlement costs below a tenth of a cent, making micropayments economically viable for the first time. ([simplescraper.io](https://simplescraper.io/blog/x402-payment-protocol); [eco.com](https://eco.com/support/en/articles/12328618-x402-protocol-explained-how-ai-agents-pay-onchain))

### Key properties for agent commerce
- **No account with the seller needed** — the payment itself is the credential.
- **No human in the loop** — an agent can make thousands of micropayments without a person approving each one.
- **Machine-discoverable pricing** — the 402 response tells the agent exactly what to pay and how.
- **Rail-agnostic but stablecoin-native** — designed for programmable, fast, low-fee settlement.
- **SDKs**: Node.js (`@x402/fetch`), Python (`x402[httpx]`), Go. `@x402/mcp` wraps MCP tools so calling a tool triggers the 402-then-pay flow. ([devtoollab.com](https://devtoollab.com/blog/x402-ai-agent-payments-guide): "If you're already building MCP servers, the `@x402/mcp` package wraps a tool so that calling it triggers the same 402-then-pay flow. An agent like Claude can pay per tool call.")

---

## 3. Cloudflare Monetization Gateway — the edge payment layer

### What it does
The [Monetization Gateway](https://blog.cloudflare.com/monetization-gateway/) is an engine that lets any Cloudflare customer charge for **any asset protected by Cloudflare**: web pages, datasets, APIs, or MCP tool calls. It provides a single control plane for payment policies and access controls, while **handling payment verification and enforcement at the edge** (protecting the origin from high payment volumes). Settlement in stablecoins over x402.

### How it works
- You write **rules** (similar to existing Cloudflare rules expressions) declaring which traffic must pay.
- The Gateway intercepts matching requests at the edge, verifies payment, and lets through only paid requests.
- The x402 handshake occurs in close proximity to the buyer (330+ cities) → low latency, origin protected.
- Manageable via dashboard, API, or **Terraform** (a paid endpoint is just infrastructure config).

### Planned capabilities
- **Charge for specific REST verbs**: e.g., $0.01 for every GET or POST to `/api/premium/*`.
- **Variable pricing**: charge variable amounts for tasks of varying complexity (e.g., image generation up to $2 depending on compute).
- **Charge only unauthenticated callers**: intercept HTTP 401 "Unauthorized" from origin and return 402 "Payment Required" instead, with pricing and payment instructions. ([Cloudflare blog](https://blog.cloudflare.com/monetization-gateway/); [digitalcxo.com](https://digitalcxo.com/article/cloudflare-monetization-gateway-would-let-companies-charge-ai-agents/); [thirdweb](https://blog.thirdweb.com/cloudflares-stablecoin-gateway-how-x402-and-ai-agents-are-creating-a-new-payment-layer-for-the-web/))

### The strategic position
Cloudflare is the proxy layer between buyers and sellers. With the Monetization Gateway, **the evidence of payment moves into the request itself, and the payment validation and the request path merge.** The metering, payment exchange, and settlement move off the origin. What stays with the publisher: rules, prices, and revenue. No buyer onboarding, no billing system to stand up. ([Cloudflare blog](https://blog.cloudflare.com/monetization-gateway/))

### Web Bot Auth + verified agent identity
The Gateway can require agents to authenticate with **Web Bot Auth** and apply usage-based pricing against accounts they already hold. This pairs with Cloudflare's broader agentic-internet work: "Every paid interaction leaves a receipt. The publisher can prove which agent fetched which page. The agent can prove it paid for what it used." ([Cloudflare: The Agentic Internet](https://blog.cloudflare.com/the-agentic-internet/))

---

## 4. The evolution: Pay Per Crawl → Pay Per Use

### Pay Per Crawl (2025)
Cloudflare's earlier feature gave site owners a third option beyond block/allow AI bots: **charge them**. Publishers could set a per-request fee for AI crawlers using the HTTP 402 status code. ([Cloudflare AI Crawl Control](https://faq.com.tw/en/developer-tools/2026-07-10-cloudflare-pay-per-crawl-ai-content-monetization-en/); [kindlycreativellc.com](https://kindlycreativellc.com/blog/cloudflare-pay-per-crawl-small-business))

### The September 15, 2026 default block
Starting September 15, 2026, Cloudflare's default settings will **block "mixed-use" crawlers** (bots that blend search + AI training/agent use) from any pages that host ads, unless the AI company pays. This applies to all free-tier customers and new sites by default — millions of publishers get the protection automatically. AI training made up 52% of crawler requests in June 2026 (up from 22% in spring 2025); mixed-use crawlers >36%. Bots made up 57.5% of all HTTP requests to HTML content in early June 2026. ([TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/); [startupfortune.com](https://startupfortune.com/cloudflare-starts-charging-ai-companies-for-the-web-data-they-once-took-free/); [valueaddvc.com](https://valueaddvc.com/pulse/cloudflare-ai-pay-publishers-policy-2026))

### Pay Per Use (the evolution)
Pay Per Crawl is evolving into **Pay Per Use** — charging AI companies **not just when they fetch content but when that content actually creates value** (e.g., when it shows up in a generated AI answer). First partners: Ceramic.ai and You.com. ([technology.org](https://www.technology.org/2026/07/03/cloudflare-blocks-mixed-use-ai-crawlers/); [TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/); [kindlycreativellc.com](https://kindlycreativellc.com/blog/cloudflare-pay-per-crawl-small-business))

> "Cloudflare's attribution, business intelligence, and enforcement tools gave publishers visibility into AI consumption at the network level — an enforcement mechanism far more effective than voluntary standards like robots.txt. For the first time, publishers could determine how their content was accessed and monetized." ([Cloudflare: Content Independence Day, one year on](https://blog.cloudflare.com/agentic-internet-bot-report/))

---

## 5. The complementary standard: Web Monetization (Interledger)

x402 is the agent-machine payment layer. **Web Monetization** (W3C standard, Interledger Protocol) is the human-browser micropayment layer — streaming payments to creators as users browse. The two are complementary.

### What it is
Web Monetization is a W3C standard for **continuous, real-time micropayments** to content creators as users consume content. A `<link rel="monetization">` tag in the page HTML declares a payment pointer; a compatible browser/wallet sends tiny payments continuously while the user remains on the page. No subscription, no paywall, no checkout — pay-as-you-browse. ([Interledger Foundation](https://interledger.org/news/web-monetization-meets-googles-offerwall); [moneywiki.app](https://moneywiki.app/wiki/w/web-monetization); [allaboutxrp.com](https://allaboutxrp.com/learn/xrp-interledger-protocol))

### 2026 progress
- **Google Offerwall integration** (March 2026): Web Monetization is now a custom choice within Google's Offerwall — publishers using Google Ad Manager can offer Web Monetization as a way for audiences to remove a paywall, alongside ads or surveys. "Web Monetization works alongside ads, subscriptions, and memberships, giving publishers a broader revenue toolkit." ([Interledger](https://interledger.org/news/web-monetization-meets-googles-offerwall); [community.interledger.org](https://community.interledger.org/interledger/web-monetization-updates-march-to-april-2026-1p6m))
- **Pay Per Article tool** (May–June 2026): publishers can place exclusive content behind a seamless paywall powered by Open Payments. ([community.interledger.org](https://community.interledger.org/interledger/web-monetization-work-in-may-june-2026-p29))
- **WordPress plugin** and publisher tools shipping; 900+ podcasts, 500,000+ writers, 200,000 social web users brought in via publishing platform partnerships. ([Interledger: Web Monetization Wrapped 2025](https://interledger.org/developers/blog/web-monetization-wrapped-2025/))

### The human/agent split
| | Web Monetization (Interledger) | x402 (Cloudflare Gateway) |
|---|---|---|
| Consumer | Human browsing | Agent requesting |
| Trigger | Time on page (streaming) | Per request (one-shot) |
| Payment rail | Interledger Protocol (Open Payments) | Stablecoins on L2 (Base, Solana) |
| Discovery | `<link rel="monetization">` tag | HTTP 402 response |
| Account needed | Wallet pointer (no seller account) | No account (payment = credential) |
| Amounts | Fractions of a cent, continuous | Fractions of a cent, per request |
| Status | W3C standard, shipping | Open standard, waitlist/early access |

**They serve different consumers**: Web Monetization for the human reader who stays on the page; x402 for the agent that fetches and moves on. A publisher can run both.

---

## 6. The eighth agent role: monetization

### A. Agent-mediated pay-per-request (the x402 layer)
A **monetization agent** configures and manages the publisher's x402 / Cloudflare Gateway rules:
- **Set pricing policies**: per-endpoint, per-resource, variable by complexity. E.g., $0.001 per article full-text fetch via MCP, $0.01 per premium API call, $0.05 per podcast episode transcript.
- **Tier access**: free public previews (RSS, Standard.site record metadata) → paid full-text (MCP tool call returns 402) → premium compute (variable pricing).
- **Charge only unauthenticated callers**: human subscribers with a session cookie get through free; unauthenticated agents get 402 with payment instructions. The Gateway intercepts the origin's 401 and returns 402.
- **Receipts & attribution**: every paid interaction leaves a receipt — the publisher can prove which agent fetched what, the agent can prove it paid. This feeds the rights/syndication agent (Part 1) and analytics agent.
- **Dynamic pricing**: adjust prices based on demand, content type, time, or agent identity (via Web Bot Auth). The monetization agent can experiment with pricing and measure conversion.

### B. Pay Per Use / outcome-based pricing
Beyond per-fetch, the monetization agent can participate in **Pay Per Use** — charging when the publisher's content **actually creates value** in an AI answer, not just when fetched. This requires attribution infrastructure (which Cloudflare is building): tracing which publisher content contributed to which AI-generated answer and settling payment accordingly. The monetization agent manages the publisher's side of this attribution-and-settlement flow.

### C. Human-side monetization (the Interledger layer)
For human readers, the monetization agent:
- Configures the Web Monetization `<link rel="monetization">` tag and payment pointer on all pages.
- Manages the Google Offerwall integration (Web Monetization as a paywall-removal option alongside ads).
- Manages the Pay Per Article tool for exclusive content.
- Tunes the mix: ads (for free readers) vs Web Monetization (for supporters) vs subscription (for members) vs per-article (for casual) — a **revenue toolkit** rather than a single model.

### D. The hybrid model — the publisher's revenue stack
The monetization agent orchestrates a **layered revenue model** matched to consumer type:

```
┌──────────────────────────────────────────────────────────────┐
│  CONSUMER TYPE          │  PAYMENT MODEL         │  RAIL     │
├─────────────────────────┼────────────────────────┼──────────┤
│ Human, free, ad-supported│ Display ads            │ Ad tech  │
│ Human, browsing          │ Web Monetization stream │ ILP      │
│ Human, casual one-off    │ Pay Per Article         │ ILP/Open │
│ Human, loyal             │ Subscription            │ Stripe/etc│
│ Agent, fetching content  │ Pay Per Request (402)   │ x402/USDC│
│ Agent, using in answer   │ Pay Per Use (attribution)│ x402/USDC│
│ Agent, calling MCP tool  │ Pay Per Tool Call (402)│ x402/USDC│
│ Agent, training           │ Licensing / bulk deal   │ negotiated│
└──────────────────────────┴────────────────────────┴──────────┘
```

The monetization agent's job is to **match the right price to the right consumer via the right rail**, automatically, without the publisher building each payment system. Cloudflare's Gateway handles the agent-side edge enforcement; Interledger/Web Monetization handles the human-side browser streaming; the subscription system handles members; the agent ties them together and tunes the mix.

---

## 7. How the Monetization Gateway fits the postulated stack

Recall the architecture from Parts 1–4:

```
PUBLIC LAYER (PDS repository → firehose → AppView)
  ├── site.standard.document (article metadata: title, summary, URL)
  ├── site.publisher.episode (podcast metadata)
  └── site.publisher.commentThread (public comments)

PRIVATE LAYER (publisher sidecar, proxied via PDS rpc)
  ├── Full article text / premium media
  ├── Entitlement / subscription state
  └── First-party analytics

LOCAL-AI EXPOSURE LAYER
  ├── MCP server (resources: read-only content; tools: entitlement-gated)
  ├── llms.txt + schema.org
  └── App Intents / App Entities (if app)
```

### Where the Gateway plugs in

**The Gateway sits in front of every HTTP endpoint the publisher exposes** — the website, the MCP server, the API, the RSS feed (if gated), the podcast media URLs (if premium). It is the **edge payment enforcement layer** that turns "this resource requires authentication" (401) into "this resource requires payment" (402) for unauthenticated agent callers.

```
                    ┌─────────────────────────┐
                    │  Cloudflare Edge (Gateway)│
                    │  + x402 enforcement       │
                    └────────────┬─────────────┘
                                 │
           ┌─────────────────────┼──────────────────────┐
           ▼                     ▼                      ▼
    ┌────────────┐      ┌──────────────┐       ┌──────────────┐
    │ Website    │      │ MCP server    │       │ API / data    │
    │ (HTML/RSS) │      │ (resources +  │       │ endpoints     │
    │            │      │  tools)       │       │               │
    └────────────┘      └──────────────┘       └──────────────┘
```

### Concrete flows

**Agent fetches article full text via MCP:**
1. Agent calls MCP tool `get_full_text(article_id)`.
2. MCP server (behind Cloudflare) checks: is this caller authenticated (human subscriber)? If yes → return content. If no (agent) → return 402 with price ($0.001) and payment instructions.
3. Agent's x402 client pays (stablecoin, sub-second), retries with payment proof.
4. Gateway verifies payment at edge → forwards to MCP server → full text returned.
5. Receipt logged → feeds analytics + rights agents.

**Agent uses content in an AI answer (Pay Per Use):**
1. Agent (e.g., You.com, Ceramic.ai) fetches article via 402-paid request.
2. Agent's answer cites the publisher's content.
3. Attribution infrastructure (Cloudflare) traces the citation.
4. Settlement: publisher paid for the *use*, not just the fetch. (This is the emerging model; first partners are live.)

**Human browses the site:**
1. Human visits article page → sees ads (free) OR has Web Monetization wallet (streaming micropayments) OR hits Offerwall (choose: ad / survey / Web Monetization) OR is a subscriber (authenticated, no paywall).
2. The Gateway's "charge only unauthenticated callers" rule means authenticated human subscribers pass through free; the 402 path is for agents, not humans.

**Reader's on-device Shortcut (Part 4) fetches RSS:**
1. Reader's Shortcuts automation calls `Get Items from RSS Feed` — RSS is public, free, no 402.
2. If the reader's Shortcut then calls `Get Article using Safari Reader` on a premium article → the Gateway returns 402 for unauthenticated callers. The Shortcut's `Get Contents of Web Page` action gets a 402, not the article. The reader would need to authenticate (subscriber) or the Shortcut would need to handle payment (not currently a Shortcuts capability — a gap).
3. **This is a gap**: Shortcuts doesn't natively handle x402 payments. The reader's on-device agent can consume free RSS previews but can't pay-per-request for premium content without a payment-aware client. The publisher's entitlement gateway (Part 2) or a future x402-aware Shortcut action would be needed.

### What the Gateway does NOT replace
- **Subscription management**: the publisher's entitlement system (Part 2 sidecar) still manages who is a subscriber; the Gateway checks "is this caller authenticated?" against that system.
- **Public PDS records**: Standard.site records on the firehose are public — they are not behind the Gateway. The Gateway is for the **private/premium** layer and the **MCP/API** layer.
- **Human micropayments**: Web Monetization (Interledger) handles the human browser streaming case; the Gateway is agent-focused.
- **On-device personalization**: the Foundation Models LLM on the reader's device (Part 3/4) processes content locally; the Gateway is about fetching the content, not processing it.

---

## 8. The monetization agent's full responsibilities

| Responsibility | How | Layer |
|---------------|-----|-------|
| **Set x402 pricing rules** | Configure Cloudflare Gateway rules: per-endpoint, per-resource, variable | Edge |
| **Tier free vs paid** | Public previews free; full text/API/tools 402-gated | Edge + sidecar |
| **Authenticate subscribers** | Gateway checks publisher entitlement system; subscribers pass free | Sidecar |
| **Collect receipts** | Every paid interaction logged; feed to analytics + rights agents | Edge → warehouse |
| **Pay Per Use attribution** | Participate in Cloudflare's attribution flow for AI-answer-based payment | Edge + Cloudflare |
| **Web Monetization config** | Manage `<link rel="monetization">`, payment pointer, Google Offerwall | Website HTML |
| **Pay Per Article** | Configure Interledger Pay Per Article tool for exclusive content | Website + ILP |
| **Revenue mix tuning** | Experiment with ad/subscription/micropayment/per-request mix; measure conversion | Analytics |
| **Dynamic pricing** | Adjust prices by demand, content type, agent identity, time | Edge rules |
| **Agent identity policies** | Require Web Bot Auth; different prices for verified vs unverified agents | Edge + Web Bot Auth |
| **Licensing/bulk deals** | Negotiate bulk access deals with AI companies (outside per-request) | Business |
| **Stablecoin → fiat** | Manage stablecoin accumulation and redemption to fiat | Treasury |

---

## 9. The strategic significance for the thesis

### This is the missing revenue half of "thrive without Google"
Parts 1–4 established how a publisher can **distribute** (ATProto, RSS, MCP) and **reach on-device AI** (App Intents, Shortcuts, MCP server) without depending on Google referral traffic. But distribution without revenue is just cost. The Monetization Gateway + x402 + Web Monetization complete the picture: the publisher can **get paid** for content consumed by agents and humans, through usage-based pricing that doesn't depend on advertising attention or subscription pre-commitment.

### Agents pay for what they use
> "Where the people who make something worth paying for get paid by the software that uses it, automatically. And where the smallest new API can reach the same buyers, on the same terms, as the largest company on the web, and the independent creator is paid by the large language models that use their work." ([Cloudflare](https://blog.cloudflare.com/monetization-gateway/))

This is the direct answer to Google Zero. Instead of Google scraping content for free to build AI Overviews that send zero traffic, agents that want the publisher's content **pay per request** (or per use) via x402. The publisher gets revenue from the agent consumption that would otherwise be extraction. The publisher doesn't need to sue or rely on voluntary robots.txt — Cloudflare enforces at the edge.

### The publisher controls the terms
> "What stays with you is what matters — your rules, your prices, and your revenue. You will not need to onboard the buyer or stand up a billing system. You will write a rule and agentic buyers will pay for what they use." ([Cloudflare](https://blog.cloudflare.com/monetization-gateway/))

The publisher sets the price. The publisher decides which resources are free (public previews, RSS, PDS records) vs paid (full text, API, MCP tools). The publisher can charge different prices to different agent types. The publisher can offer bulk licensing for training vs per-request for inference. The **monetization agent** automates the policy and tuning.

### The "not a chatbot, not feeding Google Zero" test
The monetization agent passes the test from Parts 1–4:
- It is **not a chatbot** — it's a policy engine configuring edge payment rules.
- It does **not feed Google Zero** — it charges agents that fetch content; it doesn't surrender content to cloud summarization for free. It enforces payment at the edge before the origin sees the call.
- It **serves the creator's ability to thrive** — it creates a revenue stream from agent consumption that was previously free extraction.

---

## 10. The complete agent roster (updated, eight roles)

| # | Agent role | What it does | Key tech |
|---|-----------|-------------|----------|
| 1 | **Distribution** | Publish signed records to PDS + RSS/ActivityPub/Bluesky/email/push | ATProto, firehose, Standard.site |
| 2 | **Cross-network moderation** | Unify onsite + ATProto + ActivityPub comments; emit composable labels | ATProto labelers, `com.atproto.moderation.createReport` |
| 3 | **Feed curation** | Run custom feed generators for the publisher's vertical | `com.atproto.sync.subscribeRepos`, feed generators |
| 4 | **Entitlements** | Manage paywall/subscriptions (publisher-side; never in public records) | Sidecar service, OAuth permission sets |
| 5 | **Rights/syndication** | Track reuse across firehose/RSS/partner domains; evidence packages | Firehose monitoring, C2PA, content fingerprints |
| 6 | **Analytics** | First-party + protocol data (Bluesky has no native analytics) | Firehose, AppView, first-party events |
| 7 | **Provenance** | C2PA signing, content credentials in article records | C2PA, `site.publisher.provenance` lexicon |
| **8** | **Monetization** | Configure pay-per-request (x402), Pay Per Use attribution, Web Monetization, revenue mix tuning | **Cloudflare Gateway, x402, Interledger, Web Bot Auth** |

---

## 11. Gaps, limitations, and what to watch

### Gaps
1. **Shortcuts doesn't handle x402** — the reader's on-device Shortcut (Part 4) can fetch free RSS but can't pay-per-request for premium content. A payment-aware Shortcut action or a future x402 client in Shortcuts would be needed. Current workaround: the reader authenticates as a subscriber; the Gateway lets them through free.
2. **x402 stablecoin requirement** — agents need stablecoin wallets to pay. Not all agents have them yet. The ecosystem is early (waitlist/early access as of July 2026). Goldman Sachs estimates AI agent spending on digital services could reach $50B annually by 2028. ([Sherlock](https://sherlock.xyz/post/x402-explained-the-http-402-payment-protocol))
3. **Pay Per Use attribution is nascent** — first partners (Ceramic.ai, You.com) are live but the attribution-and-settlement infrastructure for "pay when content creates value in an answer" is still emerging.
4. **Web Monetization adoption** — still small; browser support requires an extension (or future native browser support); wallet ecosystem still maturing (Chimoney shut down April 2026). ([community.interledger.org](https://community.interledger.org/interledger/web-monetization-work-in-may-june-2026-p29))
5. **Cloudflare dependency** — the Gateway is a Cloudflare product; publishers not on Cloudflare would need an equivalent edge payment layer or build their own x402 enforcement.
6. **PDS records are public** — the Gateway can't gate firehose-distributed Standard.site records; it gates the HTTP endpoints (website, MCP, API), not the protocol-level records. Public records stay public; premium content stays in the sidecar behind the Gateway.

### What to watch
- **September 15, 2026**: Cloudflare blocks mixed-use crawlers by default on ad pages → forces AI companies to separate search from training/agent crawling → accelerates Pay Per Crawl/Use adoption.
- **x402 Foundation** governance and multi-chain support (Ethereum, Solana, BNB Smart Chain already; more coming).
- **`@x402/mcp`** — the package that wraps MCP tools for pay-per-call. If a publisher's MCP server (Part 3) uses this, every tool call by an external agent is automatically pay-gated. This directly connects the MCP exposure layer to the monetization layer.
- **World (formerly Worldcoin) AgentKit** — integrates x402 for human-verified AI agents making autonomous payments. ([Sherlock](https://sherlock.xyz/post/x402-explained-the-http-402-payment-protocol))
- **Cloudflare Agents SDK** native x402 middleware — intercepts 402, fetches signature from wallet, retries automatically; the protocol is invisible above one SDK call. ([eco.com](https://eco.com/support/en/articles/14839402-x402-protocol-explained))
- **Google Offerwall + Web Monetization** — the human-side micropayment path reaching publishers who already use Google Ad Manager.
- **Interledger Pay Per Article** — the human one-off purchase path, shipping.

---

## 12. The complete picture — revenue in the agentic web

```
┌─────────────────────────────────────────────────────────────────────┐
│  PUBLISHER                                                           │
│                                                                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Editorial│  │ PDS       │  │ Entitlement  │  │ MONETIZATION   │  │
│  │ CMS      │  │ (public   │  │ Gateway      │  │ AGENT          │  │
│  │          │  │  records) │  │ (subscriber  │  │ (rules, prices,│  │
│  │          │  │           │  │  state)      │  │  receipts, mix)│  │
│  └──────────┘  └───────────┘  └──────────────┘  └────────┬───────┘  │
│       │              │                │                   │          │
│       │         ┌──────┴──────┐  ┌─────┴──────┐  ┌─────────▼────────┐│
│       │         │ RSS (public)│  │ Sidecar   │  │ Cloudflare Edge   ││
│       │         │ PDS records │  │ (premium) │  │ Monetization      ││
│       │         │ (public)    │  │           │  │ Gateway + x402    ││
│       │         └─────────────┘  └───────────┘  └────────┬──────────┘│
│       │                                                   │          │
│       │         ┌──────────────────────────────────────┐ │          │
│       │         │ MCP server (resources + tools)        │◄┤          │
│       │         │ + @x402/mcp (pay-per-tool-call)      │ │          │
│       │         └──────────────────────────────────────┘ │          │
│       │         ┌──────────────────────────────────────┐ │          │
│       │         │ Website (HTML + Web Monetization tag)│◄┤          │
│       │         │ + Google Offerwall integration        │ │          │
│       │         └──────────────────────────────────────┘ │          │
└──────────────────────────────────────────────────────────┼──────────┘
                                                           │
                    ┌──────────────────────────────────────┴───────┐
                    │            CONSUMERS                         │
                    ├────────────────┬────────────────────────────┤
                    │                │                            │
                    ▼                ▼                            ▼
          ┌──────────────┐  ┌────────────────┐          ┌────────────────┐
          │ HUMAN READER  │  │ AGENT (Siri 2.0)│          │ AI CRAWLER     │
          │              │  │ / Claude / etc. │          │ (training/inf) │
          ├──────────────┤  ├────────────────┤          ├────────────────┤
          │ Free: ads    │  │ Free: public    │          │ 402: Pay Per   │
          │ Browse: Web  │  │  RSS, PDS       │          │  Crawl / Use   │
          │  Monetization│  │  records,      │          │  (stablecoin)  │
          │  (streaming) │  │  MCP metadata  │          │  or bulk       │
          │ One-off: Pay │  │ Paid: full     │          │  licensing     │
          │  Per Article │  │  text via 402  │          │  deal          │
          │ Sub: authed  │  │  (stablecoin)  │          └────────────────┘
          │  → no paywall│  │  or subscriber  │
          └──────────────┘  │  authed → free  │
                            └────────────────┘
```

### The revenue flows
- **Human, ad-supported**: display ads (legacy ad tech)
- **Human, supporter**: Web Monetization streaming micropayments (Interledger) — fractions of a cent while reading
- **Human, casual one-off**: Pay Per Article (Interledger Open Payments)
- **Human, loyal**: subscription (Stripe etc.) — authenticated, no paywall
- **Agent, fetching content**: Pay Per Request via x402 (stablecoin) — the Gateway returns 402, agent pays, content served
- **Agent, using in AI answer**: Pay Per Use — attribution-based payment when content creates value
- **Agent, calling MCP tool**: Pay Per Tool Call via `@x402/mcp` — the MCP server is x402-wrapped
- **AI company, training**: bulk licensing deal (negotiated, outside per-request)

The monetization agent automates the policy, enforcement, receipts, and mix-tuning across all of these. The publisher writes rules; the agent and the edge handle the rest.

---

## Sources

### Cloudflare Monetization Gateway
- [Cloudflare Blog: Announcing the Monetization Gateway](https://blog.cloudflare.com/monetization-gateway/)
- [Cloudflare Blog: Building an open Agentic Internet](https://blog.cloudflare.com/the-agentic-internet/)
- [Cloudflare Blog: Content Independence Day, one year on](https://blog.cloudflare.com/agentic-internet-bot-report/)

### x402 protocol
- [x402.org](https://x402.org/)
- [Sherlock: x402 Explained](https://sherlock.xyz/post/x402-explained-the-http-402-payment-protocol)
- [allium.so: x402 Explained](https://www.allium.so/blog/x402-explained-the-internet-native-payments-standard-for-apis-data-and-agent-commerce/)
- [simplescraper.io: How to x402 Complete Guide](https://simplescraper.io/blog/x402-payment-protocol)
- [eco.com: x402 Protocol Explained](https://eco.com/support/en/articles/12328618-x402-protocol-explained-how-ai-agents-pay-onchain)
- [stablecoininsider.org: x402 Protocol](https://stablecoininsider.org/x402-protocol/)
- [devtoollab.com: x402 AI Agent Payments Guide](https://devtoollab.com/blog/x402-ai-agent-payments-guide)
- [ap7i.com: Cloudflare Monetization Gateway x402](https://ap7i.com/posts/cloudflare-monetization-gateway-x402/)
- [thirdweb: Cloudflare's Stablecoin Gateway](https://blog.thirdweb.com/cloudflares-stablecoin-gateway-how-x402-and-ai-agents-are-creating-a-new-payment-layer-for-the-web/)

### Pay Per Crawl / Pay Per Use
- [TechCrunch: Cloudflare's new policy pushes AI companies to pay](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/)
- [technology.org: Cloudflare Blocks Mixed-Use AI Crawlers](https://www.technology.org/2026/07/03/cloudflare-blocks-mixed-use-ai-crawlers/)
- [valueaddvc.com: Cloudflare AI Pay Publishers Policy](https://valueaddvc.com/pulse/cloudflare-ai-pay-publishers-policy-2026)
- [startupfortune.com: Cloudflare Starts Charging AI Companies](https://startupfortune.com/cloudflare-starts-charging-ai-companies-for-the-web-data-they-once-took-free/)
- [digitalcxo.com: Cloudflare Monetization Gateway](https://digitalcxo.com/article/cloudflare-monetization-gateway-would-let-companies-charge-ai-agents/)
- [kindlycreativellc.com: Cloudflare Pay Per Crawl](https://kindlycreativellc.com/blog/cloudflare-pay-per-crawl-small-business)
- [faq.com.tw: Cloudflare Pay Per Crawl](https://faq.com.tw/en/developer-tools/2026-07-10-cloudflare-pay-per-crawl-ai-content-monetization-en/)
- [Medium: Cloudflare Monetisation Gateway](https://medium.com/coding-nexus/cloudflare-monetisation-gateway-charge-for-any-api-website-or-ai-tool-without-building-a-payment-d55ff45fb4a2)
- [pravinkumar.co: Cloudflare Pay Per Use](https://www.pravinkumar.co/blog/cloudflare-pay-per-use-monetization-gateway-webflow-2026)

### Web Monetization / Interledger
- [Interledger Foundation: Web Monetization Meets Google's Offerwall](https://interledger.org/news/web-monetization-meets-googles-offerwall)
- [Interledger Community: Web Monetization updates Mar–Apr 2026](https://community.interledger.org/interledger/web-monetization-updates-march-to-april-2026-1p6m)
- [Interledger Community: Web Monetization updates May–Jun 2026](https://community.interledger.org/interledger/web-monetization-work-in-may-june-2026-p29)
- [Interledger: Web Monetization Wrapped 2025](https://interledger.org/developers/blog/web-monetization-wrapped-2025/)
- [moneywiki.app: Web Monetization](https://moneywiki.app/wiki/w/web-monetization)
