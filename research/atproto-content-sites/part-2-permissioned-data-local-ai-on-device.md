# ATProto, Content Sites & an Agentic Future — Research Brief, Part II

*Addendum to Part I (`/tmp/atproto-content-sites-research.md`).* Grounded in atproto.com (Spring 2026 Roadmap, Permissions spec, docs.bsky.app), Apple developer docs, modelcontextprotocol.io, llms.txt analysis, and industry sources on AI hardware failures and on-device AI.

---

## 7. "Not everything needs to be in the PDS" — Bluesky's DM sidestep, and the Permissioned Data roadmap

### 7A. How Bluesky DMs actually work — the sidestep pattern

Bluesky's direct messages are **NOT** public repository records on the firehose. They run through a **dedicated chat service** that apps reach via **service proxying** through the user's PDS. The `chat.bsky.*` API requests are proxied from the PDS to a separate chat service backend — the chat data does not flow through the public MST/repository/firehose system that carries posts, likes, and reposts. ([thetoolstrunk.com](https://thetoolstrunk.com/does-bluesky-have-group-chats/) citing Bluesky Docs "API Hosts and Auth": "Bluesky runs on the AT Protocol, where much of your data lives on a Personal Data Server (PDS). DMs, though, run through a dedicated chat service that apps reach via service proxying. That split keeps early DMs manageable…"; [docs.bsky.app/blog](https://docs.bsky.app/blog))

Bluesky's own protocol team has explicitly stated the design rationale. From the docs.bsky.app blog (tagged "updates"):

> "Just as we're currently doing with public conversation on the Bluesky app and the AT Protocol, we also want to co-design the protocol specification for **private data** in tandem with specific real-world product features… **Designing for privacy is pretty different from designing for global broadcast, and we think the data architecture will probably look pretty different from the MST + firehose system.**"

This is the authoritative confirmation of your intuition: the public PDS/repository/MST/firehose architecture is designed for **global broadcast**. Private data (DMs, private groups, gated content, paywalled content, subscriber data, private comments, entitlement state) belongs in a **separate, access-controlled service** — exactly as Bluesky did with chat.

### 7B. The "Permissioned Data" roadmap (atproto.com, Spring 2026)

The [AT Protocol Spring 2026 Roadmap](https://atproto.com/blog/2026-spring-roadmap) makes this an official protocol priority:

> **Permissioned Data** — "The original design focus of the protocol was to support public conversations in a global context. It has been clear for some time that this core functionality needs to be complemented with mechanisms for less-visible interactions within the same protocol ecosystem. This will involve new protocol concepts, sync mechanisms, and data flows. We are referring to this as **'permissioned data'**, meaning **non-public data with explicit access control**."
>
> "Several teams have been working in parallel to implement extensions to the protocol for non-public data, including **Blacksky, Northsky, and Habitat**. A sketch design proposal has been published by the Bluesky protocol team… Shipping Permissioned Data will require updates to PDS implementations, SDKs, written specifications, moderation tooling, and more. Permissioned data will probably be a major focus for the Bluesky protocol team through the summer."

**What this means for a publisher:** the protocol team acknowledges the public-record-only model is insufficient. Non-public data with explicit access control is coming — and the problems it solves map directly to publisher needs:
- Private/premium content (paywalled article full text)
- Entitlement state (who is subscribed, what they can access)
- Private comments / gated discussion threads
- Subscriber-only feeds
- Direct messages between publisher and subscribers
- Private group communities (Bluesky has announced ["communities"](https://www.theverge.com/tech/948669/blueskys-getting-group-chats) — smaller public or private spaces with their own feeds)

**Until permissioned data ships**, the pragmatic architecture (from Part I) holds: **public records (metadata + pointer) in the PDS; private/premium content behind a publisher-controlled entitlement gateway.** The DM sidestep is the proven pattern — run a sidecar service for private data, proxy through the PDS for identity/auth.

### 7C. The OAuth permission architecture enables the separation

The [atproto.com Permissions spec](https://atproto.com/specs/permission) defines granular resource types that make this separation explicit and enforceable:

| Resource | What it controls | Publisher use |
|----------|-----------------|---------------|
| `repo` | Write access to **public** repository records/collections (by NSID + action: create/update/delete) | Agent writes article/episode/provenance records to PDS |
| `rpc` | Authenticated API calls to **remote services** (by endpoint NSID + audience DID) | Agent calls AppView, feed generator, or a **publisher sidecar service** (e.g. entitlement check) |
| `blob` | Upload media files (by MIME type) | Agent uploads images/audio/video to PDS |
| `identity` | DID document + handle control | Publisher manages `did:web` domain identity |
| `account` | PDS account hosting details (email, repo import) | Publisher manages account |

**Permission sets** (lexicon schemas bundling related permissions, requested via `include:namespace.set?aud=...`) let a publisher define coherent capability bundles — e.g. `site.publisher.editorFeatures` (write article records + call entitlement RPC + upload blobs) vs `site.publisher.readerAccess` (read public records only). The namespace authority rule prevents cross-namespace permission leakage. ([atproto.com/specs/permission](https://atproto.com/specs/permission); [atproto.com/guides/oauth-patterns](https://atproto.com/guides/oauth-patterns))

**The architectural principle, grounded:**
```
PUBLIC LAYER (PDS repository → firehose → AppView)
  ├── site.standard.publication   (publication/site identity)
  ├── site.standard.document      (article metadata: title, summary, URL, author)
  ├── site.publisher.episode      (podcast episode metadata + RSS URL)
  ├── site.publisher.provenance   (C2PA manifest reference)
  └── site.publisher.commentThread (public comment root post)

PRIVATE LAYER (publisher sidecar service, proxied via PDS rpc)
  ├── Full article text / premium media    (behind entitlement)
  ├── Entitlement / subscription state      (payment system → access grants)
  ├── Private subscriber comments / DMs     (when permissioned data ships)
  ├── First-party behavioral analytics      (user understanding, see §10)
  └── Rights / syndication ledger           (private business data)
```

The PDS is the **public, portable, signed, firehose-distributed** layer. The sidecar is the **private, access-controlled, entitlement-gated** layer. OAuth permissions enforce the boundary. This is not a hack — it's the architecture Bluesky itself uses for DMs and that the protocol is formalizing as "permissioned data."

---

## 8. RSS still has a role — including paywalled previews

### RSS as the public snippet layer
RSS remains durable infrastructure, especially for podcasting (every podcast runs on RSS) and increasingly as "plumbing that quietly powers more of the web than most people realize" (Substack, Ghost, Beehiiv all publish RSS; automation workflows move content via RSS). ([ryrob RSS guide](https://www.ryrob.com/what-is-rss/); [intrepidkarthi RSS 2026](https://intrepidkarthi.com/writing/rss-in-2026-best-channel-nobody-uses/))

**For a publisher with premium content, RSS can carry previews:**
- **Partial feeds**: title + summary + first paragraph + canonical URL → reader must visit the site (behind login/paywall) for full text. Substack and Ghost support this pattern.
- **Podcast precedent — private/premium feeds**: podcasting already solved token-gated RSS. A **private podcast feed** uses a unique, secret URL (e.g. `https://publisher.com/feed/abc123-private`) that only paying subscribers receive. Apple Podcasts, Overcast, Pocket Casts treat it like any other feed, but only those with the URL can subscribe. This is a proven, battle-tested pattern for **entitlement-gated open-protocol distribution.** ([podcast-generator.ai](https://podcast-generator.ai/blog/rss-podcast-feed); [beamly.com](https://beamly.com/podcast-rss-feed/))
- **Written content equivalent**: a publisher could expose a **public RSS feed** of article previews (title + summary + paywall pointer) and a **private RSS feed** of full-text articles for subscribers (token-gated URL, validated against the entitlement gateway). This mirrors exactly the PDS pattern: public Standard.site record has title+summary+URL; private full-text is behind auth.

### RSS ↔ ATProto coexistence
RSS and ATProto are complementary, not competing:
- **RSS** = pull-based, polling, simple XML, universal client support, great for podcasts and email/newsletter integration, no identity model.
- **ATProto** = push-based (firehose), signed records, identity (DID), composable moderation (labelers), custom lexicons for rich app semantics, real-time.
- A publisher can publish the **same content** to both: the CMS emits an article → distribution agent writes a `site.standard.document` record to the PDS AND updates the RSS feed. RSS serves feed readers and podcast directories; ATProto serves Bluesky, custom feeds, AppViews, and atproto-native clients. The canonical URL is the same in both.

---

## 9. Agent for building out your PDS + a new type of CMS

### Is an agent that scaffolds/manages a publisher's PDS valuable? Yes.

A "PDS builder agent" would:
1. **Provision identity**: set up `did:web` on the publisher's domain (verifiable, portable, publisher-owned).
2. **Define lexicons**: scaffold `site.publisher.article`, `.episode`, `.series`, `.author`, `.rights`, `.provenance`, `.commentThread` — extending Standard.site where applicable.
3. **Publish records**: on CMS publish/update/correction events, create/update/delete records in the PDS via `com.atproto.repo.createRecord` / `applyWrites`, maintaining strong refs and CIDs.
4. **Sync state**: keep CMS ↔ PDS in sync (the CMS remains editorial-authoritative; the PDS is the public distribution layer). The agent is the bridge.
5. **Manage blobs**: upload images/audio/video, respect MIME-type blob permissions.
6. **Wire OAuth**: set up permission sets for editor vs reader vs agent-service identities.

This is not speculative — **EmDash** (Cloudflare's atproto-native CMS) already "baked Standard.site into its publishing toolchain from the beginning, including the ability to log in with your atproto handle." **Sequoia** is a CLI tool that publishes Standard.site records from static-site generators (Astro, Hugo, Eleventy, Jekyll). The **wordpress-atmosphere** plugin cross-posts from WordPress and adds Standard.site records. ([atproto.com: atmospheric-website](https://atproto.com/blog/atmospheric-website); [atproto.com: Standard.site](https://atproto.com/blog/standard-site-bluesky-timeline))

### CMS-primary vs PDS-primary — two architectures

| | **CMS-primary** (WordPress + ATmosphere) | **PDS-primary** (EmDash-style) |
|---|---|---|
| Source of truth | WordPress database | PDS repository records |
| ATProto role | Secondary — plugin syncs records on publish | Primary — CMS writes to PDS, renders from AppView/PDS |
| Portability | CMS-locked; PDS is a mirror | Content is portable by protocol design |
| Migration | Export from CMS, re-import elsewhere | DID + PDS migration is protocol-native |
| Complexity | Lower (existing CMS + plugin) | Higher (new CMS built on atproto primitives) |
| Best for | Publishers with existing WordPress/proprietary CMS | Publishers building greenfield, want protocol-native architecture |

**A PDS-native CMS** would treat the PDS repository as the primary content store, render the website from PDS records (via the publisher's own AppView or directly), and use ATProto identity (did:web) for author/user identity. The website becomes **one view of the protocol records** — not a separate system that syncs to the protocol. This is architecturally cleaner and more portable, but requires building CMS-grade editing, scheduling, rights, and paywall on top of atproto primitives + a sidecar for private data. EmDash is the closest existing example.

**The agent opportunity**: an agent that manages the PDS layer for a publisher — regardless of whether the CMS is WordPress or EmDash — is the "new type of CMS" in the sense that it makes the PDS a first-class, programmable content layer rather than a sync target. The agent turns "publishing to the open web" from a manual multi-channel chore into an automated, policy-driven operation.

---

## 10. Exposing content to local / on-device AI (without feeding Google Zero)

### 10A. The failure of cloud personal AI assistants (outside the SF bubble)

The standalone personal-AI-assistant category has largely failed:

- **Humane AI Pin**: Launched Nov 2023 at $699 + $24/mo subscription. Shut down servers Feb 28, 2025. HP acquired remnants for $116M. Reviews panned it as slow (up to 10s response latency), unreliable, overheating, poor battery, ergonomic nightmare. "The purest case study in what happens when a team with elite credentials builds a product that solves a problem nobody has." ([digitalapplied.com](https://www.digitalapplied.com/blog/ai-product-failures-2026-sora-humane-rabbit-lessons); [Medium: Anatomy of a Failure](https://medium.com/@bossaresearch/anatomy-of-a-failure-the-humane-ai-pin-and-the-misfit-future-of-wearable-ai-04feedd82903); [tooldirectory.ai](https://tooldirectory.ai/tools/humane); [everydayaitech.com](https://www.everydayaitech.com/en/articles/ai-gadgets-flop-2025))
- **Rabbit R1**: $199, no subscription, but "half-baked on day one" and "mostly a cautionary tale." ~100K units sold. Still receiving updates but pivoted toward DLAM (desktop control). ([blogviro.com](https://blogviro.com/world-wide/humane-ai-pin-vs-rabbit-r1-why-both-failed/); [Reddit r/Rabbitr1](https://www.reddit.com/r/Rabbitr1/comments/1rp6ase/))
- **Friend Pendant, others**: part of the "$200M lost" AI gadget graveyard. ([gadgetreactor.com](https://www.gadgetreactor.com/2026/07/the-ai-gadget-graveyard-why-every-ai-pendant-watch-and-pin-has-flopped/))
- **Shared failure pattern**: "a spectacular demo generates massive media coverage, which drives initial adoption or pre-orders" → production reality doesn't match demo → novelty-driven usage fades → shutdown or pivot. None asked users to adopt a fundamentally new interaction paradigm that was better than the smartphone they already had. ([digitalapplied.com](https://www.digitalapplied.com/blog/ai-product-failures-2026-sora-humane-rabbit-lessons))

**The SF-bubble lesson**: cloud-connected standalone AI assistants requiring new hardware + subscription + new interaction paradigm have not achieved mass adoption and likely won't. Consumers don't want another device or another subscription for a marginal capability gain over their smartphone.

### 10B. On-device AI IS real and growing

On-device AI wins because it leverages the device consumers already have, with privacy/latency/no-subscription/offline/trust advantages:

- **Apple Intelligence** (iOS 18→27): on-device Foundation Models (1.2T parameter MoE in iOS 27), personal context understanding, on-screen awareness. Siri rebuilt on App Intents. Apple reached a $250M class-action settlement over false Siri AI advertising — showing the stakes and the commitment. ([aimadetools.com](https://www.aimadetools.com/blog/siri-ai-developers-app-intents-2026/); [techtimes.com WWDC 2026](https://www.techtimes.com/articles/318005/20260608/wwdc-2026-app-intents-replaces-sirikit-gemini-siri-migration-clock-starts.htm))
- **WWDC 2026**: SiriKit formally **deprecated**; **App Intents is now the only framework** through which Siri AI can call into third-party apps. 2–3 year migration window. ([techtimes.com](https://www.techtimes.com/articles/318005/20260608/wwdc-2026-app-intents-replaces-sirikit-gemini-siri-migration-clock-starts.htm); [lushbinary.com](https://lushbinary.com/blog/sirikit-to-app-intents-migration-guide/); [ecorpit.com](https://ecorpit.com/ios-27-app-intents-siri-ai-developer-guide-2026/))
- **Gemini Nano** on Android/Chrome; **local LLMs** (Ollama, llama.cpp, MLX on Apple Silicon) for developers and power users.
- **Why on-device wins**: privacy (data doesn't leave device), latency (no network round-trip), no subscription, works offline, user trust (the user's own AI, not a cloud intermediary). The hybrid on-device + cloud (Private Cloud Compute for heavy tasks) is the emerging model.

### 10C. How a publisher exposes content to local/on-device AI (the core question)

The key distinction: **expose to the user's own local AI for their benefit** ≠ **feed cloud AI for summarization (Google Zero)**. The former is a service to the reader; the latter surrenders content to an intermediary's answer box. Here are the concrete paths:

#### Path 1: Apple App Intents + App Entities (if the publisher has an app)
From [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/):
- **App Entities**: model your content (articles, episodes, authors, topics) as entities. "Entity schemas contribute your content to the **Spotlight semantic index** for personal context understanding." Siri can then reference and retrieve your content.
- **App Intents**: expose actions ("read article X", "play latest episode", "show me today's tech news from [publisher]"). "Intent schemas let people take action on that content naturally, with no specific phrases to define and no code changes needed as Siri's language understanding evolves."
- **View Annotations API**: map on-screen views to entities so Siri can reference what the user is looking at.
- **Shortcuts**: Apple Intelligence assembles automations from natural-language descriptions; your exposed intents become building blocks.
- **Foundation Models framework** (iOS 26+): if the publisher wants to run its own on-device LLM with custom tools, the `Tool` protocol enables direct in-app LLM tool calls (parallel to App Intents, which is the cross-app/Siri surface). ([blakecrosley.com](https://blakecrosley.com/blog/app-intents-are-apples-new-api-to-your-app))

**For a publisher app**: expose App Entities for articles/episodes → Siri can say "read me the latest Vergecast episode" or "what did [publisher] say about [topic]?" — the content is served **from the publisher's app/cache**, on-device, for the user's benefit. The publisher controls what's exposed (previews vs full text, entitlement-gated).

#### Path 2: llms.txt — the B2A (Business-to-Agent) surface
`/llms.txt` is a proposed standard: a markdown file at the site root that tells AI agents what content is available and where to find it, in a machine-readable, context-efficient way. ([agentpatterns.ai](https://www.agentpatterns.ai/standards/llms-txt/); [limy.ai](https://limy.ai/blog/llms.txt-in-2026-the-full-guide); [canlah.ai](https://canlah.ai/blog/what-is-llms-txt-2026/))
- **One fetch replaces undirected crawling.** Agent spends context budget on content, not discovery.
- **Companion `/llms-full.txt`**: every linked page concatenated — agent gets the whole site in one fetch.
- **Agentic llms.txt** (Wix, Mastercard, Google ADK pattern): includes a section telling agents what they can **do** on the site, not just read — and can point to an **MCP server** for authenticated, scoped action. ([wix.com AI Search Lab](https://www.wix.com/studio/ai-search-lab/llms-txt-files-for-agents))
- **Reality check**: a 300K-domain analysis found **no measurable effect of llms.txt on AI citation likelihood**; adoption near 10% even among tech-forward publishers. No major LLM provider has confirmed they read it at inference time. **Treat it as forward-compatible agent infrastructure, not an SEO/citation play.** A stale/broken llms.txt is worse than none. ([agentpatterns.ai](https://www.agentpatterns.ai/standards/llms-txt/); [newtarget.com](https://www.newtarget.com/web-insights-blog/what-is-llms-txt/))
- **Publisher use**: llms.txt can direct AI engines toward **canonical reporting** vs thin SEO content; can mark `## Allowed Content` (public guides, article previews) vs `## Restricted Content` (premium-content/). Compliance is voluntary (like robots.txt early days). ([seolinkworld.com](https://seolinkworld.com/llms-txt-controlling-ai-crawlers/))

**Strategic framing**: llms.txt is not about getting cited by ChatGPT (that's feeding cloud AI). It's about giving **the user's own local AI agent** (Claude Desktop, a local LLM, an IDE agent) a clean entry point to your content. Combined with an MCP server (below), it becomes a controlled channel: "here's what I'll let your agent read, here's how, behind my entitlement."

#### Path 3: MCP (Model Context Protocol) — the controlled channel
MCP (launched by Anthropic Nov 2024, donated to the Linux Foundation's Agentic AI Foundation Dec 2025, backed by OpenAI/Google/Microsoft/AWS/Cloudflare) is the open standard for AI agents to connect to external data sources in real time. SDK downloads hit **97M/month by March 2026**. ([alien.club](https://www.alien.club/blog/what-is-mcp-a-publisher-s-plain-english-guide-to-model-conte/); [modelcontextprotocol.io](https://modelcontextprotocol.io))

A publisher can expose an **MCP server** that provides:
- **Resources** (read-only data): articles, episode metadata, author profiles, feed items — exposed as URIs the AI client can fetch. ([modelcontextprotocol.io: Resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources); [zuplo.com](https://zuplo.com/blog/mcp-resources))
- **Tools** (actions): "search articles", "get full text" (entitlement-gated), "subscribe to feed", "submit comment".
- **Prompts**: few-shot examples for interacting with the content.

**Why MCP is the right pattern for "expose to local AI without feeding Google Zero":**
- The publisher **controls the channel**: authenticates each AI client, applies pricing/entitlement, logs every query, can expose public content while keeping premium content behind paywall, can block specific AI systems entirely. ([alien.club](https://www.alien.club/blog/what-is-mcp-a-publisher-s-plain-english-guide-to-model-conte/))
- Contentful's MCP server is a live precedent: read-only vs read-write tool categories, per-environment permission gating, human confirmation of tool calls. ([contentful.com docs](https://www.contentful.com/developers/docs/tools/mcp-server/))
- The user's local AI (Claude Desktop, an on-device LLM with MCP client) queries the publisher's MCP server → gets content **on the publisher's terms** → the user benefits, the publisher retains control, and the content is **not scraped into a cloud training corpus or answer box**.
- **`mcpdoc` / LangChain**: open-source MCP servers already expose llms.txt files to host applications (Cursor, Windsurf, Claude Desktop) via a `fetch_docs` tool. The llms.txt → MCP pipeline already exists for docs; the same pattern works for publisher content. ([limy.ai](https://limy.ai/blog/llms.txt-in-2026-the-full-guide))

#### Path 4: schema.org / JSON-LD structured data
Well-structured `Article`, `BlogPosting`, `NewsArticle`, `PodcastEpisode` schema with `author`, `publisher`, `datePublished`, `isAccessibleForFree` properties gives on-device parsers (and Spotlight indexing) semantic structure. Combine with llms.txt for the AI-agent entry point. ([canlah.ai](https://canlah.ai/blog/what-is-llms-txt-2026/): "Combining llms.txt with robust Schema Markup creates a powerful signal for AI.")

#### Path 5: RSS/Atom as a local-AI-subscribable feed
RSS is already machine-readable. A local AI agent (or an MCP server wrapping RSS) can subscribe to a publisher's RSS feed and have new content arrive in its context. For premium content, the token-gated private RSS pattern (§8) applies.

#### Path 6: Semantic, accessible HTML
The foundation under all of the above: well-structured, semantic HTML with proper headings, article markup, alt text, canonical URLs. Content that is accessible to humans is accessible to local AI. This is the opposite of "AI slop" — it's content that is **machine-readable for the user's own agent without being cloud-scrapable for summarization** (the publisher controls access via entitlement/robots/llms.txt/MCP auth).

### 10D. The "expose to local AI vs. feed cloud AI" distinction — sharpened

| | **Expose to local AI** (user's own agent) | **Feed cloud AI** (Google Zero / ChatGPT summarization) |
|---|---|---|
| Who benefits | The user (their Siri/local LLM can access content) | The intermediary (answers extracted, user doesn't visit) |
| Publisher control | Full (entitlement, MCP auth, llms.txt scoping) | Little (scraped, summarized, cited-or-not) |
| Traffic outcome | User may still visit app/site for full experience | User never visits |
| Data flow | Publisher → user's device (controlled) | Publisher → cloud → user (extracted) |
| Mechanism | App Intents, MCP server, llms.txt, RSS, semantic HTML | Crawl → AI Overview / chatbot answer |
| Relationship | Strengthens publisher-reader relationship | Intermediates it away |

**The strategic imperative**: be machine-readable for the user's own agent, but NOT freely scrapable for cloud summarization. This means: robots.txt/Google-Extended controls for cloud crawlers; MCP/llms.txt/App Intents for the user's local agent. The publisher offers a **controlled channel** to local AI, not an open firehose to cloud AI.

---

## 11. Personalization via first-party user understanding + on-device AI

### 11A. An agent that understands individual users (not a chatbot)

If a publisher web app can understand user behavior via first-party analytics — an agent processing on-site behavior (reading patterns, topic interests, depth of engagement, device/context, time-of-day) — it can personalize **beyond "recommended articles"**:

- **Adaptive UIs**: surface topic verticals the reader actually cares about; collapse sections they never open; adjust density/typography for skimmers vs deep readers; progressive disclosure for different reader types (casual browser vs power reader vs professional researcher).
- **Content surfacing**: interest-graph-based home pages; "you missed this last week" for returning readers; contextual deep-dives for readers who engaged deeply with a related story.
- **Reading-flow optimization**: next-article suggestions based on the reader's current session arc, not just generic popularity.

### 11B. The privacy-preserving split: server-side understanding + on-device personalization

The key insight for the post-surveillance-capitalism era: **the publisher doesn't need to hoard user data to personalize.** A better architecture:

1. **Publisher sends structured content** (articles, metadata, topic tags) to the user's device via the web app / RSS / PDS records / MCP.
2. **The user's device personalizes locally** — using Apple Intelligence / on-device LLM / the browser's local models to rank, filter, and surface content based on the user's on-device behavior graph (which the publisher never sees in detail).
3. **The publisher gets aggregated, consented signals** ("topic X had high engagement this week") not individual surveillance profiles.

This is the **on-device personalization** model: the personalization happens on the user's device, using the user's own behavioral data that never leaves the device. The publisher provides the content substrate; the device provides the personalization engine. This aligns with:
- Apple Intelligence's "personal context" (reads from App Entities / on-device data, not cloud profiles).
- The broader industry shift away from third-party cookies / surveillance adtech.
- User trust (the user's AI works for the user, not for an ad network).

### 11C. Contrast with the old model

| | **Surveillance-capitalism personalization** | **On-device personalization** |
|---|---|---|
| Where data lives | Server-side (publisher + ad networks hoard user profiles) | On-device (user's behavior graph stays local) |
| Who personalizes | Server (sends personalized page to user) | Device (local AI ranks/filters publisher's content) |
| Privacy | Poor (tracking, profiling, data breaches) | Strong (no data leaves device) |
| Trust | Low (users feel watched) | High (user's AI serves the user) |
| Publisher role | Hoards data, sells access to profiles | Provides structured content substrate |
| Regulatory fit | Fights GDPR/CCPA | Aligns with GDPR/CCPA (data minimization) |

**The agent's role**: the publisher's first-party analytics agent processes **consented, aggregated** signals to understand content performance and audience-level patterns, while the **individual** personalization is delegated to the user's device. The publisher agent informs editorial decisions ("our readers engage deeply with climate investigations"); the on-device AI informs individual experience ("show this reader more climate content because they read 3 articles on it this week").

---

## 12. Synthesis — the expanded architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PUBLISHER (authoritative)                         │
│  ┌─────────────┐   ┌──────────────────┐   ┌───────────────────────┐  │
│  │ Editorial   │   │ PDS Builder Agent │   │ Entitlement Gateway   │  │
│  │ CMS         │──→│ (did:web, lexicons│   │ (payment → access     │  │
│  │             │   │  record sync,     │   │  grants; private      │  │
│  │             │   │  blob mgmt, OAuth)│   │  sidecar service)     │  │
│  └──────┬──────┘   └────────┬──────────┘   └───────────┬───────────┘  │
│         │                   │                           │              │
│         │      ┌────────────▼──────────┐                │              │
│         │      │ Publisher PDS (PUBLIC)│                │              │
│         │      │ site.standard.* +    │                │              │
│         │      │ site.publisher.*     │                │              │
│         │      │ (article, episode,   │                │              │
│         │      │  provenance,         │                │              │
│         │      │  commentThread)      │                │              │
│         │      └────────────┬──────────┘                │              │
│         │                   │ firehose                  │              │
│         │      ┌────────────▼──────────┐                │              │
│         │      │ RSS (public previews) │                │              │
│         │      │ RSS (private/premium, │                │              │
│         │      │  token-gated)         │                │              │
│         │      └───────────────────────┘                │              │
│         │                                                │              │
│         │      ┌────────────────────────────────────────▼──┐          │
│         │      │ PRIVATE SIDECAR (proxied via PDS rpc)      │          │
│         │      │ • Full article text / premium media         │          │
│         │      │ • Entitlement / subscription state          │          │
│         │      │ • Private comments / DMs (when perm. data)  │          │
│         │      │ • First-party analytics (aggregated)        │          │
│         │      └────────────────────────────────────────────┘          │
│         │                                                              │
│         │      ┌──────────────────────────────────────────────┐        │
│         └─────→│ LOCAL-AI EXPOSURE LAYER                       │        │
│                │ • /llms.txt + /llms-full.txt (curated)        │        │
│                │ • MCP server (resources: read-only content;   │        │
│                │   tools: search, get-full-text [entitlement]) │        │
│                │ • schema.org JSON-LD (Article, PodcastEpisode)│        │
│                │ • robots.txt / Google-Extended (block cloud   │        │
│                │   AI summarization scrapers)                  │        │
│                │ • App Intents / App Entities (publisher app)  │        │
│                └──────────────────┬───────────────────────────┘        │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │
                                    │ controlled channel
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    USER'S DEVICE (local AI)                          │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Apple     │  │ On-device    │  │ MCP client  │  │ Browser /   │  │
│  │Intelligence│ │ LLM (Ollama, │  │ (Claude     │  │ local models│  │
│  │ / Siri    │  │  MLX, llama) │  │  Desktop)   │  │             │  │
│  │ App Intents│ │              │  │             │  │             │  │
│  │ App Entities│ │              │  │             │  │             │  │
│  └─────┬─────┘  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  │
│        └───────────────┴─────────────────┴────────────────┘          │
│                        │                                              │
│                        ▼                                              │
│         ON-DEVICE PERSONALIZATION                                     │
│         (local AI ranks/filters publisher content                     │
│          based on user's on-device behavior graph;                    │
│          publisher gets aggregated consented signals only)            │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (user visits app/site for full experience)
                          PUBLISHER APP / WEBSITE
                          (adaptive UI, premium content,
                           cross-protocol comments via atproto threads)
```

### The flows

**Publish flow**: CMS → PDS Builder Agent → (public record to PDS + RSS preview + llms.txt/MCP resource update) → firehose → Bluesky / custom feeds / AppView. Private full-text → entitlement-gated sidecar.

**Read flow (local AI)**: User asks Siri / local LLM "what did [publisher] say about [topic]?" → App Intents (if app) or MCP server (if desktop/local LLM) → publisher serves content via controlled channel → local AI presents to user → user may visit site/app for full experience.

**Personalize flow**: Publisher sends structured content to device → on-device AI personalizes based on local behavior graph → publisher receives only aggregated/consented signals → editorial decisions informed; individual privacy preserved.

**Comment flow**: User replies on site or via local AI → creates `app.bsky.feed.post` reply record (via PDS, OAuth-scoped) → appears in atproto network thread → embedded on article page via `getPostThread` → bidirectional with ATmosphere/Juttu pattern.

**Entitlement flow**: User's local AI requests full text via MCP tool → MCP server checks entitlement (publisher sidecar) → returns full text if entitled, preview + paywall CTA if not → local AI respects the boundary.

---

## 13. Key gaps and opportunities (updated)

### Gaps
1. **Permissioned data not yet shipped** — the sidecar pattern works now but is non-standardized; the atproto protocol team is actively working on it (Summer 2026 focus).
2. **llms.txt has no proven citation/traffic uplift** — treat as forward-compatible infrastructure, not an SEO play. Compliance is voluntary; cloud AI scrapers may ignore it.
3. **MCP for publishers is early** — Contentful has a model; no major news publisher has shipped a public MCP server yet (as of research date). The pattern is proven for docs/IDE use cases.
4. **App Intents requires a native app** — web-only publishers can't use App Entities/Intents directly (though Safari/Spotlight indexes web content on-device). For web-only, the path is MCP + llms.txt + schema.org + semantic HTML.
5. **On-device personalization is nascent** — Apple Intelligence personal context exists but publisher-specific on-device ranking isn't a shipped product pattern yet. The publisher would need to provide structured content + an MCP/App Intents surface and let the device's AI do the ranking.
6. **The "local AI vs cloud AI" boundary is porous** — Apple Intelligence uses Private Cloud Compute for heavy tasks; the publisher can't fully guarantee content stays on-device once it's in an LLM context. MCP auth + entitlement gating is the best control, not a guarantee.
7. **Analytics attribution is hard** — when a user's local AI consumes content via MCP/App Intents, the publisher may not get traditional pageview analytics. New engagement metrics (MCP query logs, App Intent donations, entitlement checks) are needed.

### Opportunities
- **Be the first publisher to expose an MCP server** for content access — controlled, entitlement-gated, local-AI-friendly. This is a genuine differentiator.
- **llms.txt + MCP + schema.org as a coordinated "AI-readable" surface** — one curated entry point for local AI agents, distinct from the cloud-scrapable web.
- **PDS-native CMS (EmDash model) + PDS Builder Agent** — make atproto the primary content layer, not a sync target.
- **On-device personalization as a trust differentiator** — "our AI works on your device, for you; we don't hoard your data" is a compelling brand position in the post-cookie era.
- **Token-gated RSS for premium content** — the podcasting pattern, applied to written content, with atproto records as the public preview layer.
- **Permissioned data (when it ships)** — native atproto support for private/premium content, private comments, subscriber-only feeds, and DMs — replacing the sidecar with protocol-native access control.
- **Cross-protocol comments (atproto threads embedded on articles)** — already shipping (ATmosphere, Juttu); the publisher gets free Bluesky distribution of every comment thread.

### The sharpened thesis
The publisher's content, identity, and distribution become **portable and operationally programmable** via agents — with ATProto as the public backbone (signed records, firehose, custom lexicons, composable moderation, ownable identity), a **sidecar service** for private/entitled data (the DM pattern, formalized as "permissioned data"), RSS for universal feed distribution (including token-gated premium previews), and a **controlled local-AI exposure layer** (MCP server + llms.txt + App Intents + schema.org) that lets the user's own on-device AI access content **on the publisher's terms** — without feeding cloud AI summarization. Personalization moves **on-device**: the publisher provides the content substrate, the user's AI personalizes locally, the publisher gets consented aggregated signals. Agents throughout manage distribution, moderation, entitlements, curation, rights, provenance, and analytics — none are chatbots, none feed Google Zero, all serve the creator's ability to thrive making real content for their audience.

---

## Sources (Part II)

### atproto.com / docs.bsky.app (grounded technical facts)
- [AT Protocol Spring 2026 Roadmap (Permissioned Data)](https://atproto.com/blog/2026-spring-roadmap)
- [Permissions spec](https://atproto.com/specs/permission)
- [OAuth Patterns guide](https://atproto.com/guides/oauth-patterns)
- [Standard.site blog](https://atproto.com/blog/standard-site-bluesky-timeline)
- [Build an Atmospheric Website](https://atproto.com/blog/atmospheric-website)
- [docs.bsky.app blog (updates tag — private data architecture quote)](https://docs.bsky.app/blog/tags/updates)
- [docs.bsky.app blog (federation tag)](https://docs.bsky.app/blog/tags/federation)
- [GitHub: bluesky-social/atproto](https://github.com/bluesky-social/atproto)

### Bluesky DMs / chat sidestep
- [thetoolstrunk.com: Does Bluesky Have Group Chats?](https://thetoolstrunk.com/does-bluesky-have-group-chats/) — "DMs run through a dedicated chat service that apps reach via service proxying"
- [The Verge: Bluesky's getting group chats + communities](https://www.theverge.com/tech/948669/blueskys-getting-group-chats)
- [mackuba.eu: Introduction to AT Protocol](https://mackuba.eu/2025/08/20/introduction-to-atproto/)
- [posterly: Bluesky Guide 2026](https://www.poster.ly/guides/bluesky-guide)

### RSS / podcast feeds
- [ryrob.com: What is RSS? 2026 Guide](https://www.ryrob.com/what-is-rss/)
- [podcast-generator.ai: RSS Podcast Feed Definitive Guide](https://podcast-generator.ai/blog/rss-podcast-feed)
- [beamly.com: What is a Podcast RSS Feed?](https://beamly.com/podcast-rss-feed/)
- [intrepidkarthi.com: RSS in 2026](https://intrepidkarthi.com/writing/rss-in-2026-best-channel-nobody-uses/)

### AI hardware failures
- [digitalapplied.com: AI Product Failures 2026](https://www.digitalapplied.com/blog/ai-product-failures-2026-sora-humane-rabbit-lessons)
- [Medium: Anatomy of a Failure — Humane AI Pin](https://medium.com/@bossaresearch/anatomy-of-a-failure-the-humane-ai-pin-and-the-misfit-future-of-wearable-ai-04feedd82903)
- [tooldirectory.ai: Humane (Deceased)](https://tooldirectory.ai/tools/humane)
- [blogviro.com: Humane AI Pin vs Rabbit R1](https://blogviro.com/world-wide/humane-ai-pin-vs-rabbit-r1-why-both-failed/)
- [everydayaitech.com: AI Gadget Flops 2025](https://www.everydayaitech.com/en/articles/ai-gadgets-flop-2025)
- [gadgetreactor.com: The AI gadget graveyard](https://www.gadgetreactor.com/2026/07/the-ai-gadget-graveyard-why-every-ai-pendant-watch-and-pin-has-flopped/)

### Apple Intelligence / App Intents / on-device AI
- [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/)
- [techtimes.com: WWDC 2026 — App Intents Replaces SiriKit](https://www.techtimes.com/articles/318005/20260608/wwdc-2026-app-intents-replaces-sirikit-gemini-siri-migration-clock-starts.htm)
- [lushbinary.com: SiriKit to App Intents Migration Guide](https://lushbinary.com/blog/sirikit-to-app-intents-migration-guide/)
- [ecorpit.com: iOS 27 App Intents Developer Guide](https://ecorpit.com/ios-27-app-intents-siri-ai-developer-guide-2026/)
- [ecorpit.com: iOS 27 App Intents and AI agents strategy](https://ecorpit.com/ios-27-app-store-ai-agents-app-intents-developer-strategy-2026/)
- [aimadetools.com: Siri AI for Developers](https://www.aimadetools.com/blog/siri-ai-developers-app-intents-2026/)
- [blakecrosley.com: App Intents Are Apple's New API](https://blakecrosley.com/blog/app-intents-are-apples-new-api-to-your-app)
- [techbetweenthelines.com: App Intents Are the New ASO](https://www.techbetweenthelines.com/app-intents-are-the-new-aso-how-siri-ai-will-discover-apps/)

### llms.txt
- [agentpatterns.ai: llms.txt standard](https://www.agentpatterns.ai/standards/llms-txt/)
- [limy.ai: LLMs.txt in 2026](https://limy.ai/blog/llms.txt-in-2026-the-full-guide)
- [canlah.ai: What is llms.txt 2026](https://canlah.ai/blog/what-is-llms-txt-2026/)
- [newtarget.com: llms.txt and AI access](https://www.newtarget.com/web-insights-blog/what-is-llms-txt/)
- [seolinkworld.com: llms.txt controlling AI crawlers](https://seolinkworld.com/llms-txt-controlling-ai-crawlers/)
- [wix.com AI Search Lab: agentic llms.txt](https://www.wix.com/studio/ai-search-lab/llms-txt-files-for-agents)
- [Medium/Google Cloud: Give AI Agents Deep Understanding With llms.txt](https://medium.com/google-cloud/give-your-ai-agents-deep-understanding-with-llms-txt-4f948590332b)

### MCP
- [modelcontextprotocol.io: Resources spec](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [modelcontextprotocol.io: Architecture](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)
- [GitHub: modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- [contentful.com: MCP server docs](https://www.contentful.com/developers/docs/tools/mcp-server/)
- [alien.club: What Is MCP? A Publisher's Guide](https://www.alien.club/blog/what-is-mcp-a-publisher-s-plain-english-guide-to-model-conte/)
- [zuplo.com: What Are MCP Resources?](https://zuplo.com/blog/mcp-resources)

### Publisher traffic / Google Zero (from Part I, still relevant)
- [Reuters Institute 2026 trends](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026)
- [Nieman Lab: search traffic decline / opt-out of Google](https://www.niemanlab.org/2026/07/search-traffic-has-declined-so-much-that-some-publishers-are-considering-opting-out-of-google-entirely/)
- [The Verge: Conde Nast calls Google Zero](https://www.theverge.com/google/929641/conde-nast-calls-google-zero)
