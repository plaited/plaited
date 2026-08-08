# ATProto, Content Sites, and an Agentic Future — Research Brief

*Grounded in atproto.com / docs.bsky.app / bluesky-social/atproto where technical facts are stated.
Publisher-distribution and Google-Zero evidence from Reuters Institute, Pew, Chartbeat, SparkToro/Datos, DCN, Nieman Lab, Press Gazette, Axios, Search Engine Journal.*

---

## 0. The question, reframed

You are not building a social app like Bluesky, and not just a blog. You're asking about a **content publisher** (think The Verge: articles + podcast RSS + social syndication + embedded social feeds + cross-commenting) that must now thrive in a world where **Google referral traffic is collapsing ("Google Zero")**, and where AI agents are everywhere — but you explicitly do *not* want agents as chatbots, and you do *not* want to feed "Google Zero" / AI-search summarization. You want agents that play an **operational role** in the publisher's ability to make real (non-slop) content and distribute it to its audience via open protocols, with ATProto as a candidate backbone.

This brief answers: (1) what ATProto actually is and whether a non-social app can build on it; (2) the Google-Zero pressure that makes this urgent; (3) what genuinely useful, non-chatbot agent roles exist; (4) cross-protocol commenting/embeds; (5) a target architecture and its gaps.

---

## 1. ATProto fundamentals (grounded in atproto.com)

### Architecture in one paragraph
ATProto ("Authenticated Transfer Protocol") is a decentralized social-media protocol. Identity is a **DID** (`did:plc` or `did:web`); handles are portable and resolve to DIDs. Each account is a **repository** — a signed, append-only log of **records** grouped into **collections**, stored on a **PDS (Personal Data Server)** which is the sole write authority. A **relay** fans in every PDS's commit stream into one global **firehose** (`com.atproto.sync.subscribeRepos`) and fans it out. An **AppView** subscribes to the firehose, builds indexes (timelines, follower graphs, threads, search), and serves hydrated queries. **Feed generators** and **labelers** also consume the firehose. Records are schema'd by **Lexicons** (NSID-namespaced, e.g. `app.bsky.feed.post`). ([atproto.com blog: Standard.site](https://atproto.com/blog/standard-site-bluesky-timeline); [docs.bsky.app federation blog](https://docs.bsky.app/blog/tags/federation); [mackuba.eu intro](https://mackuba.eu/2025/08/20/introduction-to-atproto/); [Jeff Bailey mental model](https://jeffbailey.us/blog/2026/05/25/what-is-atproto/))

### The primitives that matter for a publisher
- **`did:web` + domain identity** → a publisher can own its identity via its own domain. This is the publisher's portable, verifiable handle.
- **Self-hosted PDS** → a publisher can run its own PDS (Bluesky ships a reference distribution; self-hosted PDSes are crawled by the relay and routed to AppViews/feed generators/labelers). Bluesky's sandbox notes rate limits (~10 accounts, 1500 evts/hr per self-hosted PDS in sandbox) — production scaling needs real infra. ([docs.bsky.app federation](https://docs.bsky.app/blog/tags/federation))
- **Custom Lexicons** → the key enabler for non-social apps. A Lexicon defines the shape of a record type. Anyone can define a new NSID (e.g. `site.publisher.article`) and publish records; other apps *can* read them because lexicons are interoperable by default. ([atproto.com: Standard.site blog](https://atproto.com/blog/standard-site-bluesky-timeline): "Lexicons are essential for building custom apps on atproto and because they are interoperable by default, any other app can read the public records defined by another apps' Lexicons.")
- **Firehose / Jetstream** → real-time global distribution. `com.atproto.sync.subscribeRepos` (WebSocket) carries every commit. Jetstream is a lighter filtered WebSocket that delivers only subscribed collections upstream, drastically reducing egress vs. full-firehose local filtering. ([atproto.com: Indexing Standard.site](https://atproto.com/blog/indexing-standard-site); [atproto.com: Feeds guide](https://atproto.com/guides/feeds))
- **AppView** → a publisher can build its own AppView to index its custom lexicons and serve article/episode/thread views without depending on Bluesky's AppView.
- **Feed generators** → custom algorithmic feeds; consume firehose, index, rank, return post IDs to the AppView. Official TS example maintained by Bluesky. ([atproto.com: Feeds](https://atproto.com/guides/feeds))
- **Labelers** → independent services with their own DID that emit labels on records/content; clients opt in via `atproto-accept-labelers` header and choose show/warn/hide policy. Reports via `com.atproto.moderation.createReport`. Composable moderation. ([atproto.com: Labeler Subscriptions](https://atproto.com/guides/subscriptions))
- **Records are public by default.** Blobs have size limits (images ~1MB, raising to 2MB). This matters: **premium/entitled content should NOT live in public records** — put metadata + a pointer in the record, keep full text/media behind a publisher authorization layer.

### Standard.site — the proof point that non-social publishing on atproto already works
[Standard.site](https://atproto.com/blog/standard-site-bluesky-timeline) is a community-built Lexicon set (`site.standard.publication`, `site.standard.document`, `site.standard.subscription`) for publishing websites/articles/newsletters to your PDS. **WordPress released a plugin** (`wordpress-atmosphere`) that publishes a Standard.site record per post and cross-posts to Bluesky; **EmDash** baked it in; **Leaflet, pckt.blog, Offprint, Sequoia** are publishing apps on it. Bluesky now gives Standard.site links **richer in-app previews** via `associatedRefs` (strongRefs to the document + publication records) on `app.bsky.embed.external`. ([atproto.com: atmospheric-website blog](https://atproto.com/blog/atmospheric-website); [GitHub discussion #4978](https://github.com/bluesky-social/atproto/discussions/4978))

**Implication:** a news/content publisher publishing article records to its own PDS, discoverable via firehose + a custom AppView, syndicating into Bluesky with enhanced embeds — is not theoretical. It's shipping.

### SDKs
- TypeScript: `@atproto/lex` (new, type-safe, code-gen from Lexicons) preferred; `@atproto/api` (older, still widely used); `@atcute/client` (lightweight). ([GitHub: bluesky-social/atproto](https://github.com/bluesky-social/atproto); [npm: @atcute/client](https://www.npmjs.com/package/@atcute/client))
- Python: official posting guide uses raw HTTP/XRPC; `MarshalX/atproto` library. ([atproto.com: create-post blog](https://atproto.com/blog/create-post))
- Dart/Flutter: `myConsciousness/atproto.dart`.
- OAuth preferred over app passwords for third-party user auth (`@atproto/oauth-client-*`).

---

## 2. Google Zero — why this is urgent now

### The collapse
- **"Google Zero"** was coined by The Verge's Nilay Patel: "that moment when Google Search simply stops sending traffic outside of its search engine to third-party websites." Conde Nast's CEO now says they're **assuming all search traffic will be zero**. ([Nieman Lab](https://www.niemanlab.org/2026/07/search-traffic-has-declined-so-much-that-some-publishers-are-considering-opting-out-of-google-entirely/); [The Verge: Conde Nast calls Google Zero](https://www.theverge.com/google/929641/conde-nast-calls-google-zero))
- **Zero-click searches:** SparkToro/Datos 2024 — ~58.5% US / 59.7% EU of Google searches end without an open-web click; only 360 US open-web clicks per 1,000 searches. Rose from 45% (2016) → 49% (2019) → 60%+ (2024) → ~68% (2025). ([SparkToro](https://sparktoro.com/blog/zero-click-search-what-still-works/); [SparkToro top posts](https://sparktoro.com/blog/our-top-5-blog-posts-in-2025-to-help-you-with-your-marketing-in-2026/))
- **AI Overviews (AIO):** rolled out to all US users May 2024, 200+ countries by 2025. Pew (68,879 searches, March 2025): users clicked a conventional result **8%** of the time when an AI summary appeared vs **15%** without — ~47% relative reduction; almost never clicked AIO-cited sources. Ahrefs: first organic result loses ~34.5% of clicks when AIO appears. Seer Interactive (42 orgs, millions of impressions): **61% organic CTR decline** for AIO queries Jun 2024 → Sep 2025. ([Pew](https://www.pewresearch.org/short-reads/2025/12/09/striking-findings-from-2025/); [ppc.land](https://ppc.land/researchers-find-google-ai-overviews-cut-publisher-clicks-39-8/); [Search Engine Journal](https://www.searchenginejournal.com/impact-of-ai-overviews-how-publishers-need-to-adapt/556843/))
- **Publisher traffic declines:** Chartbeat (2,500+ sites, via Reuters Institute): Google organic search **−33% globally / −38% US** Nov 2024→Nov 2025; Google Discover −16%. By publisher size over 2 years: **small −60%, medium −47%, large −22%** — brand/direct-audience insulation is real. DCN (19 premium publishers): median Google referral −10% over 8 weeks May–Jun 2025, losses 2:1 over gains. Business Insider −55% (Apr 2022→Apr 2025); NYT search share 44%→37%; Digital Trends −97%; Chegg −49% (non-subscriber). ([Reuters Institute 2026 trends](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026); [Axios/Chartbeat](https://www.axios.com/2026/03/17/chartbeat-search-traffic-ai-chatbots); [DCN](https://digitalcontentnext.org/blog/2025/08/14/facts-googles-push-to-ai-hurts-publisher-traffic/); [AdExchanger](https://www.adexchanger.com/publishers/the-ai-search-reckoning-is-dismantling-open-web-traffic-and-publishers-may-never-recover/); [Nieman Lab on AI sources <1% of pageviews](https://www.niemanlab.org/2026/03/ai-sources-like-chatgpt-account-for-less-than-1-of-publishers-pageviews-chartbeat-says/))
- **Most exposed:** recipes, how-to/service journalism, reference, affiliate/"best X", evergreen explainers. News less consistently hit by AIO but aggregate search decline still bites. Reuters Institute: publishers scaling *back* service journalism/evergreen/general news, scaling *up* original investigations, contextual analysis, human stories. ([Reuters Institute](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026); [Nieman Lab: tech pub traffic −58%](https://www.niemanlab.org/2026/03/traffic-to-top-tech-publications-has-plummeted-since-2024-new-analysis-shows/))

### The social-referral collapse alongside it
- Facebook referrals to news **−43%**; X **−46%** over 3 years (Reuters Institute). X publisher referrals **−75%** 2019→2025 (Press Gazette); global Chartbeat Twitter traffic **−70%** since Musk's 2022 acquisition (Nieman Lab). Reddit referrals **+118%** since Feb 2024 (Press Gazette) and Reddit ranks for "best X" queries + has a ~$60M/yr Google deal. ([Press Gazette](https://pressgazette.co.uk/media-audience-and-business-data/media_metrics/publisher-traffic-sources-2019-2025/); [Nieman Lab](https://www.niemanlab.org/2026/04/social-traffic-kinda-stinks-for-news-publishers-now-in-3-charts/))

### Bluesky as a referrer
- Bluesky reached ~40M users by late 2025 (from 10M Sep 2024). News-influencer Bluesky adoption 21%→43% post-2024-election (Pew). It's **link-friendly** (welcomes external links, chronological/algorithm-optional feeds, strong professional/journalism/science/tech communities). Anecdotes: some publishers saw **3–4× the referral traffic from Bluesky vs X/Threads** (Dec 2024); Southern Fried Science reported Bluesky drove **100× the pageviews of Twitter** in 2025. Not representative market-wide — reflects audience composition — but directionally significant for audience-aligned publishers. ([Digital Culture Network](https://digitalculturenetwork.org.uk/knowledge/what-is-bluesky-and-should-it-be-a-part-of-your-social-media-strategy/); [Wired/Ars Technica](https://arstechnica.com/science/2025/08/more-scientists-choose-bluesky-over-twitter/); [Pew](https://www.pewresearch.org/short-reads/2025/05/29/bluesky-has-caught-on-with-many-news-influencers-but-x-remains-popular/); [netinfluencer stats](https://www.netinfluencer.com/twitter-alternatives-in-2026-the-platform-didnt-get-replaced-it-got-unbundled/))

### Podcasting as the open-protocol success story to emulate
Podcasting proves "publish once to an open RSS feed, many clients distribute it" works. One canonical feed → Apple/Spotify/Overcast/Pocket Casts all ingest; portable subscriptions; creator-controlled hosting. **Lesson for written content:** keep the site/feed canonical, syndicate to platforms without surrendering the source, support RSS even if minority use, never let a platform's copy be the only copy. (Caveat: Spotify/YouTube are de-prioritizing RSS for closed features — lock-in pressure is real.) ([ryrob RSS guide](https://www.ryrob.com/what-is-rss/); [podcast-generator.ai](https://podcast-generator.ai/blog/rss-podcast-feed); [blog.descontrolepodcast on RSS death pressures](https://blog.descontrolepodcast.com/the-death-of-rss-how-podcast-distribution-is-changing-forever/))

### Strategic bottom line
Search is shifting from **referral** to **visibility/citation/brand**. Publishers retaining **direct, owned, permissioned, recurring** audience relationships (email, subscriptions, apps, podcasts, RSS, interoperable social protocols) are far less exposed. This is the strategic frame for everything below.

---

## 3. The agentic future for content creators — NOT chatbots, NOT feeding Google Zero

The useful agentic future is **not a conversational layer**. It is a set of **autonomous editorial-operations services** that execute publisher policy across open distribution networks, while the publisher's CMS, audience relationship, subscriptions, and first-party analytics remain authoritative. Agents are **event processors and policy executors**, not chatbots and not slop generators.

### 3A. Programmatic distribution agent
- Detects publication/update/correction/embargo/withdrawal events from the CMS.
- Creates canonical article/episode/author/series/publication records in the publisher's ATProto repository (custom lexicon or Standard.site).
- Generates platform-specific derivatives: RSS/Atom, ActivityPub `Article`/`Note`/`Announce`, ATProto records, Bluesky `app.bsky.feed.post` announcements with external embeds, email editions, web-push.
- Applies per-platform length/image/accessibility/link/UTM/disclosure rules; retries, dedupes, preserves canonical URLs, retracts/updates syndicated copies; keeps a delivery ledger.
- ATProto fits because content is written as **signed repository records** and relays distribute changes to AppViews/feed generators/consumers — the publisher doesn't need Bluesky to be its CMS.

### 3B. Cross-network comment moderation agent
- Unifies onsite comments + ATProto replies + ActivityPub replies/mentions + reports from editors/readers/labelers.
- Classifies spam/scams/abuse/impersonation/off-topic/likely-automated; assigns confidence; applies allow/hold/hide/remove-locally/label/escalate policy; preserves audit trail + appeal path.
- Uses ATProto's **composable labeler** model: independent labelers emit labels (with their own service DID), clients choose show/warn/hide. Reports via `com.atproto.moderation.createReport`. The agent emits labels like `publisher-spam`, `verified-author`, `rights-violation`, `unverified-source`, `synthetic-media` — display policy stays with consuming apps. ([atproto.com: Labeler Subscriptions](https://atproto.com/guides/subscriptions))

### 3C. Publisher-specific feed curation agent
- Runs custom feed generators for verticals ("all climate investigations", "verified semiconductor reporting", "podcasts from our network", "replies from accredited experts").
- Consumes firehose/Jetstream, resolves article/author records, filters by lexicon/publication/author/topic/language/rights/label, ranks by editorial rules, excludes spam/unprovenanced AI material.
- Feed generators return post IDs to AppView (don't hydrate everything themselves). Feed feedback (likes / "show more" / "show less") observable via firehose to tune ranking. ([atproto.com: Feeds](https://atproto.com/guides/feeds); [atproto.com: Serving the For You feed](https://atproto.com/blog/serving-the-for-you-feed))

### 3D. Entitlements & subscriptions agent
- Connects payment system → CMS access controls, web/app sessions, premium podcast feeds, newsletter membership, partner apps, ATProto-aware reading apps, token-gated archives.
- Reconciles renewals/cancellations/grace periods/refunds/household/device limits; issues signed entitlement assertions or short-lived tokens.
- **Critical limitation:** ATProto has **no general-purpose paywall / private-content entitlement protocol** today. Standard.site's subscription record tracks *which publications a user follows*, not payment/access. **Design rule: keep entitlement decisions in the publisher's service. Public ATProto records carry metadata + pointer; protected content stays behind publisher authorization. Never put premium text/media in public records or public blobs.**

### 3E. Rights & syndication enforcement agent
- Attaches license/territory/embargo/attribution/expiry/reuse terms to CMS assets; generates per-partner syndication manifests.
- Monitors ATProto firehose, ActivityPub objects, RSS mirrors, search indexes, known partner domains for reuse; compares text/image-hash/audio-fingerprint/canonical-ID.
- Builds evidence packages (original record + CID + timestamp + signature + license + detected reuse); triggers notices/takedowns/billing/human review.
- **Caveat:** firehose only sees public ATProto records — not private systems, unindexed ActivityPub servers, screenshots, altered text, offline copies. Full-firehose indexing is expensive at scale; use **Jetstream** for filtered ingestion. ([atproto.com: Indexing Standard.site](https://atproto.com/blog/indexing-standard-site))

### 3F. Audience analytics agent
- Joins first-party data (CMS, RSS, podcast downloads, email, push) with protocol data (ATProto post/reply/like/repost/quote/feed-inclusion, ActivityPub delivery, AppView/feed-generator observations, UTM conversions).
- Outputs: reach by protocol/feed/author/story; first-appearance & downstream spread; which communities/feeds discover a story; conversation quality (not just reaction volume); conversion from federated engagement → registration/subscription; cross-network duplication.
- **Why it matters:** publishers are losing control of referral channels; Bluesky has **no mature native analytics dashboard** → first-party measurement + UTM is essential. Respect privacy/deletion/opt-outs/platform ToS — public firehose access ≠ invasive profiling license. ([theblue.social](https://theblue.social/articles/bluesky-social-listening-audience-insights-tips); [Vizion](https://www.vizion.com/blog/introduction-to-bluesky-the-new-social-media-network/))

### 3G. Provenance & authenticity agent
- Verifies incoming **C2PA** credentials; signs original photos/video/audio/graphics/docs with publisher identity, author, editorial-review, source, edit, AI-use assertions; preserves provenance through CMS transforms & syndication; stores a manifest URL/reference in the ATProto article record.
- Labels records/assets with missing/invalid/inconsistent provenance as a **positive authenticity signal** (not a perfect AI detector).
- **C2PA proves provenance, not truth.** Credentials can be stripped by screenshots/re-encoding; absence of a credential proves little while most content is unsigned. But it's the strongest emerging standard (Adobe, Microsoft, BBC, Leica, Nikon, Sony, Canon, Samsung shipping support). ([editorsweblog C2PA guide](https://editorsweblog.org/2026/04/10/what-is-c2pa-complete-guide-content-provenance); [beeler.tech](https://www.beeler.tech/2026/07/15/publishers-need-receipts-c2pa-may-be-one-way-to-get-them/); [GitHub: c2pa-rs](https://github.com/contentauth/c2pa-rs))

> **Key distinction from "feeding Google Zero":** these agents distribute, moderate, curate, entitle, track rights, measure, and sign provenance for the *publisher's own* structured records across open protocols. They are not summarizing content for an intermediary's answer box. The publisher's content stays canonical and owned; agents extend its operational reach.

---

## 4. Cross-protocol commenting & embeds

### Pattern 1 — Canonical Bluesky root post (simplest, already shipping)
1. Publish article → create a canonical Bluesky post linking to it → store the resulting AT-URI + CID in the CMS.
2. Fetch the thread via `app.bsky.feed.getPostThread` (public unauth: `https://public.api.bsky.app`; auth: proxied via PDS).
3. Render replies as comments on the article; link readers back to Bluesky to reply.

**Real implementations:**
- **Juttu** — AGPL, self-hostable Bluesky-powered comment widget; every comment is a real Bluesky post owned by the reader. ([juttu.app](https://juttu.app/))
- **WordPress ATmosphere plugin** — cross-posts articles to Bluesky + stores Standard.site records; Bluesky replies/likes/reposts show as WordPress comments; approved publisher-team comments are sent back as Bluesky replies. **Bidirectional.** ([wordpress.org/plugins/atmosphere](https://wordpress.org/plugins/atmosphere/))
- **quarto-ext/bluesky-comments** — embed threaded Bluesky conversations in Quarto docs. ([GitHub](https://github.com/quarto-ext/bluesky-comments))
- **florianschepp/bsky-comments** — zero-dependency Web Component. ([GitHub](https://github.com/florianschepp/bsky-comments))
- **bluesky-comments (React)** — filtering + custom empty states. ([reactscript](https://reactscript.com/embed-bluesky-comment-threads/))

### Pattern 2 — Bidirectional comments (logged-in reader, linked ATProto identity)
For a reader whose site account is linked to an ATProto identity, the site creates a reply record via the user's PDS (OAuth):

```json
{
  "$type": "app.bsky.feed.post",
  "text": "Comment from the article site",
  "createdAt": "2026-08-08T00:00:00Z",
  "reply": {
    "root":   { "uri": "at://did:…/app.bsky.feed.post/ROOT",   "cid": "bafyre…" },
    "parent": { "uri": "at://did:…/app.bsky.feed.post/PARENT", "cid": "bafyre…" }
  }
}
```
ATProto replies require **strong references to both root and immediate parent** (`com.atproto.repo.strongRef`). The record is owned by the user, appears in the network, retrievable via `getPostThread`. For users without ATProto accounts: require account creation on a compatible service, or offer a clearly-labeled publisher-controlled "publication comments" identity, or store onsite only. **Do not** post a publisher-generated account as if it were the reader's personal identity. ([docs.bsky.app: getPostThread](https://docs.bsky.app/docs/api/app-bsky-feed-get-post-thread); [GitHub discussion #1180](https://github.com/bluesky-social/atproto/discussions/1180); [atproto.com: create-post](https://atproto.com/blog/create-post))

### Pattern 3 — Custom article-comment lexicon
Define `site.publisher.article` / `.comment` / `.commentThread` / `.moderationDecision`. Comment record carries article strong-ref, parent comment ref, author DID, body+facets, timestamps, moderation status, rights/visibility, onsite render link, optional ActivityPub object ID. **Pros:** native article semantics, long comments, editorial replies, moderation metadata, easier cross-mapping. **Cons:** Bluesky won't auto-render custom records as ordinary comments; publisher must run an AppView or persuade clients; cross-client notification/reply conventions must be designed; doesn't auto-solve identity/spam/entitlement.

### ActivityPub interop (lossy by nature)
ActivityPub exchanges JSON-LD activities between actors/inboxes (server-centric federation), not one common firehose. A cross-protocol comment agent needs a mapping table (AT-URI/CID ↔ ActivityPub object URL; DID ↔ actor; replyRef ↔ inReplyTo; label ↔ local moderation state; article record ↔ Article object/canonical URL). **It's necessarily lossy** — visibility/threading/deletion/moderation/federation rules differ. Preserve each network's original identifier and display the source network; don't pretend there's one perfectly-synchronized universal comment object. WordPress's ActivityPub plugin illustrates the practical mapping pains (likes/reposts leaking into standard comments, etc.). ([Wikipedia: ActivityPub](https://en.wikipedia.org/wiki/ActivityPub); [Automattic/wordpress-activitypub discussions](https://github.com/Automattic/wordpress-activitypub/discussions/1120))

---

## 5. Target architecture (synthesis)

```
                ┌─────────────────────────────────────────────┐
                │  Editorial CMS (authoritative)              │
                │  articles · episodes · corrections · rights │
                │  paywall · subscriber accounts · canonical  │
                └───────────────┬─────────────────────────────┘
                                │ publish events
                   ┌────────────┴───────────────────┐
                   ▼                                ▼
        ┌────────────────────┐           ┌──────────────────────┐
        │ Publisher PDS      │           │ Distribution-agent   │
        │ (did:web domain)   │           │ mesh: ATProto · RSS  │
        │ Standard.site +    │           │ ActivityPub · email  │
        │ custom lexicons    │           │ push · partner synd  │
        │ (article, episode, │           └──────────┬───────────┘
        │  series, rights,   │                      │
        │  provenance,       │                      ▼
        │  commentThread)    │           ┌──────────────────────┐
        └─────────┬──────────┘           │ Entitlement gateway  │
                  │ firehose             │ (publisher-controlled)│
                  ▼                      │ payment→access grants │
        ┌────────────────────┐           └──────────┬───────────┘
        │ Relay / Jetstream  │                      │
        └─────────┬──────────┘                      ▼
                  │                      ┌──────────────────────┐
   ┌──────────────┼──────────────┐       │ Moderation fabric:   │
   ▼              ▼              ▼       │ onsite · ATProto     │
┌────────┐  ┌──────────┐  ┌──────────┐  │ labeler · ActivityPub│
│Bluesky │  │Publisher │  │ Feed     │  │ adapters · human Q   │
│AppView │  │ AppView  │  │generators│  └──────────────────────┘
└────────┘  └────┬─────┘  └──────────┘
                 │
   ┌─────────────┼──────────────┬───────────────┐
   ▼             ▼              ▼               ▼
┌────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────┐
│Article │ │ Rights & │ │ Analytics & │ │ Provenance   │
│ embeds │ │ syndic.  │ │ audience    │ │ pipeline    │
│/cross- │ │ agent    │ │ products    │ │ (C2PA sign) │
│comment │ │          │ │             │ │             │
└────────┘ └──────────┘ └─────────────┘ └──────────────┘
```

**Component responsibilities (summary):**
1. **CMS + first-party identity** — authoritative for content, corrections, rights, paywall, subscribers, canonical URLs.
2. **Publisher PDS** (`did:web`) — portable public record layer (Standard.site + custom lexicons). *Not* the entire CMS/payment/private archive.
3. **Distribution-agent mesh** — separate agents per channel (ATProto, ActivityPub, RSS/podcast, email, push, partner syndication, corrections/retractions); each with outbox, retries, idempotency, per-network formatting, delivery ledger.
4. **Relay ingestion + publisher AppView** — firehose/Jetstream consumer → durable event log → AppView indexing publisher lexicons → rights/analytics warehouse → moderation event processor.
5. **Moderation fabric** — onsite trust-and-safety + ATProto labeler + ActivityPub adapters + human review + abuse signals. Labels are *policy outputs*, not hidden deletions.
6. **Entitlement gateway** — evaluates identity/subscription/article/device/geo/embargo/license → short-lived access grants to web/app/podcast/email/compatible readers. Public records identify content; don't expose premium content.
7. **Provenance pipeline** — verify source credentials, preserve manifests, sign derivatives, store manifest refs in article/media records, emit authenticity/synthetic-media labels.
8. **Analytics & audience products** — measure first-party outcomes (completion, registration, subscription, podcast follow, newsletter conversion, discussion quality, feed discovery, cross-network repeat readership) — *the direct alternative to optimizing for Google summaries*.

---

## 6. Limitations, gaps, and opportunities

### Limitations / gaps
1. **ATProto is public by default** — unsuitable for premium article text or private subscriber data in records.
2. **No universal entitlement/paywall standard** — Standard.site subscriptions = following, not payment/auth. Entitlement stays publisher-side.
3. **Firehose scale is expensive** — full-network ingestion, CAR decoding, blob retrieval, indexing = real infra cost. Jetstream mitigates but doesn't eliminate.
4. **Practical centralization** — protocol permits independent infra, but most users depend on a small number of relays/AppViews (Bluesky's defaults). Architecture is decentralized; user control isn't automatic. ([Jeff Bailey](https://jeffbailey.us/blog/2026/05/25/what-is-atproto/))
5. **Deletion/moderation lag** — a deleted PDS record can remain visible in downstream AppView indexes until they process the delete/takedown. (Documented bug: posts remain on bsky.app after successful `deleteRecord`.) ([GitHub issue #4826](https://github.com/bluesky-social/atproto/issues/4826))
6. **ActivityPub ≠ mechanically interchangeable with ATProto** — identity, threading, delivery, moderation, deletion semantics differ; mapping is lossy.
7. **Comments require identity** — site can't post a reader's comment to ATProto as that reader without the reader's authorization.
8. **C2PA proves provenance, not truth** — strippable by screenshots; absence proves little.
9. **Blob/media limits** — images ~1MB→2MB; large reporters/publishers need substantially more storage than microbloggers.
10. **Analytics incomplete** — public engagement events ≠ unique humans/demographics/attention/conversion.

### Opportunities
- Standardized article/episode/rights/entitlement/comment lexicons (extend Standard.site).
- Portable publisher AppViews competing on reading experience, not data ownership.
- **Feed generators as editorial products** — topic channels, investigative collections, local news, subscriber feeds.
- Composable publisher labelers for provenance/verification/corrections/rights.
- Cross-protocol identity & moderation mappings (lossy but useful).
- Open C2PA-to-Lexicon provenance conventions.
- Protocol-native subscription receipts revealing entitlement without exposing payment.
- Publisher-operated analytics measuring conversion & audience quality across open networks.
- **CMS plugins making federation as routine as RSS** (the ATmosphere/WordPress precedent is the template).

### The strategic thesis
The goal is *not* to "win" a social network. It's to make the publisher's content, identity, distribution, moderation, provenance, and audience relationship **portable and operationally programmable** via agents that serve the creator — while retaining first-party control over subscriptions and editorial standards. ATProto is a strong candidate backbone because: identity is ownable (`did:web`), data is signed and portable (PDS + repository), distribution is real-time and open (firehose/Jetstream), app semantics are extensible (custom lexicons), moderation is composable (labelers), and the publishing-on-atproto pattern is *already proven* by Standard.site + WordPress. RSS remains the right tool for podcast feeds; ActivityPub remains the right tool for Mastodon/fediverse reach. Agents knit these together operationally so the publisher thrives *without* depending on Google referral traffic and *without* becoming AI-slop fodder for answer engines.

---

## Sources (key)
- atproto.com: [Standard.site blog](https://atproto.com/blog/standard-site-bluesky-timeline) · [atmospheric-website](https://atproto.com/blog/atmospheric-website) · [Indexing Standard.site](https://atproto.com/blog/indexing-standard-site) · [Serving the For You feed](https://atproto.com/blog/serving-the-for-you-feed) · [create-post](https://atproto.com/blog/create-post) · [Feeds guide](https://atproto.com/guides/feeds) · [Labeler Subscriptions](https://atproto.com/guides/subscriptions)
- docs.bsky.app: [federation blog](https://docs.bsky.app/blog/tags/federation) · [getPostThread](https://docs.bsky.app/docs/api/app-bsky-feed-get-post-thread) · [blog](https://docs.bsky.app/blog)
- GitHub: [bluesky-social/atproto](https://github.com/bluesky-social/atproto) · [discussion #4978 (Standard.site integration)](https://github.com/bluesky-social/atproto/discussions/4978) · [discussion #1180 (replies)](https://github.com/bluesky-social/atproto/discussions/1180) · [issue #4826 (delete lag)](https://github.com/bluesky-social/atproto/issues/4826) · [ATmosphere plugin](https://wordpress.org/plugins/atmosphere/) · [c2pa-rs](https://github.com/contentauth/c2pa-rs) · [quarto-ext/bluesky-comments](https://github.com/quarto-ext/bluesky-comments) · [florianschepp/bsky-comments](https://github.com/florianschepp/bsky-comments) · [juttu.app](https://juttu.app/)
- Publisher-traffic / Google Zero: [SparkToro](https://sparktoro.com/blog/zero-click-search-what-still-works/) · [Pew 2025](https://www.pewresearch.org/short-reads/2025/12/09/striking-findings-from-2025/) · [Reuters Institute 2026](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026) · [Axios/Chartbeat](https://www.axios.com/2026/03/17/chartbeat-search-traffic-ai-chatbots) · [DCN](https://digitalcontentnext.org/blog/2025/08/14/facts-googles-push-to-ai-hurts-publisher-traffic/) · [Nieman Lab](https://www.niemanlab.org/2026/07/search-traffic-has-declined-so-much-that-some-publishers-are-considering-opting-out-of-google-entirely/) · [Press Gazette](https://pressgazette.co.uk/media-audience-and-business-data/media_metrics/publisher-traffic-sources-2019-2025/) · [Search Engine Journal](https://www.searchenginejournal.com/impact-of-ai-overviews-how-publishers-need-to-adapt/556843/) · [ppc.land](https://ppc.land/researchers-find-google-ai-overviews-cut-publisher-clicks-39-8/) · [AdExchanger](https://www.adexchanger.com/publishers/the-ai-search-reckoning-is-dismantling-open-web-traffic-and-publishers-may-never-recover/) · [The Verge: Conde Nast Google Zero](https://www.theverge.com/google/929641/conde-nast-calls-google-zero) · [Alta](https://www.altaonline.com/dispatches/a70466591/ai-overviews-google-zero-search-traffic/)
- Bluesky/social: [Pew news influencers](https://www.pewresearch.org/short-reads/2025/05/29/bluesky-has-caught-on-with-many-news-influencers-but-x-remains-popular/) · [Wired/Ars](https://arstechnica.com/science/2025/08/more-scientists-choose-bluesky-over-twitter/) · [Digital Culture Network](https://digitalculturenetwork.org.uk/knowledge/what-is-bluesky-and-should-it-be-a-part-of-your-social-media-strategy/) · [netinfluencer](https://www.netinfluencer.com/twitter-alternatives-in-2026-the-platform-didnt-get-replaced-it-got-unbundled/)
- Protocols: [Wikipedia: ActivityPub](https://en.wikipedia.org/wiki/ActivityPub) · [arxiv: Bluesky & ATProto](https://arxiv.org/html/2402.03239v2) · [ryrob RSS](https://www.ryrob.com/what-is-rss/)
- Provenance: [editorsweblog C2PA](https://editorsweblog.org/2026/04/10/what-is-c2pa-complete-guide-content-provenance) · [beeler.tech](https://www.beeler.tech/2026/07/15/publishers-need-receipts-c2pa-may-be-one-way-to-get-them/)
