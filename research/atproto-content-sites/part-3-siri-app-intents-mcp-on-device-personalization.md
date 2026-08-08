# Siri, App Intents, MCP & On-Device Personalization — Deep Dive

*Part 3 of the ATProto content-sites research.* Grounded in Apple Developer docs, WWDC 2026 coverage, Blake Crosley's technical analysis, 9to5Mac, modelcontextprotocol.io, and industry sources.

---

## The core question, stated precisely

> "Siri on your iPhone can interact with MCP servers or custom skills through Apple Shortcuts or native integrations like Apple's App Intents framework."

**Is this true?** The answer is **yes, with important nuance** — and it became much more true at WWDC 2026 (iOS 27). Here's the precise breakdown.

---

## 1. The three-protocol stack: App Intents, Foundation Models, MCP

Apple now has **three distinct protocol surfaces** for exposing an app's domain to a language model. They differ in **who runs the model**:

| Protocol | Who runs the model | Caller | Transport | Status |
|----------|-------------------|--------|-----------|--------|
| **App Intents** | Apple Intelligence (system agent) | Siri, Spotlight, Shortcuts, Widgets | Swift typed intents in-process | **Mandatory** in iOS 27 (SiriKit deprecated WWDC 2026) |
| **Foundation Models** | Your app (on-device) | Your app's own code | `LanguageModelSession` + `Tool` protocol | Shipped iOS 26 (WWDC 2025), expanded iOS 27 |
| **MCP** | External host (Claude, ChatGPT, Cursor, or Siri 2.0) | Any MCP-compatible agent | JSON-RPC over stdio or Streamable HTTP | System-wide in iOS 27; first code in iOS 26.1 beta |

([Blake Crosley: Foundation Models On-Device LLM](https://blakecrosley.com/blog/foundation-models-on-device-llm); [Blake Crosley: App Intents vs MCP](https://blakecrosley.com/blog/app-intents-vs-mcp-tools-frontier))

### The routing rule (who calls, not what runs)

```
        ┌──────────────────────────────────┐
        │  Who is the language model?       │
        └────┬─────────────┬─────────────┬──┘
             │             │             │
    ┌────────┴────┐ ┌──────┴──────┐ ┌────┴──────┐
    │ Your app's  │ │   Apple     │ │  External │
    │ own use of  │ │ Intelligence│ │   host's  │
    │   LLM       │ │   agent     │ │   agent   │
    └──────┬──────┘ └──────┬──────┘ └────┬──────┘
           │               │             │
           ▼               ▼             ▼
    Foundation Models  App Intents     MCP
    + Tool protocol    + AppEntity    + tools/list
    (on-device, your  (system runs   (host runs
     app runs model)   the model)     the model)
```

The key insight from Crosley: **the same Swift domain function can serve all three surfaces.** The domain layer is protocol-agnostic; App Intents, Foundation Models `Tool`, and MCP tool handlers are thin adapters over shared domain methods. ([Blake Crosley: App Intents vs MCP](https://blakecrosley.com/blog/app-intents-vs-mcp-tools-frontier))

---

## 2. Can Siri actually talk to MCP servers? The evidence

### Phase 1: Groundwork laid (iOS 26.1 beta, September 2025)

9to5Mac discovered MCP integration code in the first developer beta of iOS 26.1 / iPadOS 26.1 / macOS Tahoe 26.1:

> "Based on code introduced in today's betas, we can confirm that **Apple is laying the groundwork to bring MCP support to App Intents.**" ([9to5Mac](https://9to5mac.com/2025/09/22/macos-tahoe-26-1-beta-1-mcp-integration/))

> "Apple plans to let developers use a **system-level MCP integration** to expose actions and functionalities within their apps to AI platforms and agents." — including "Interactions with Siri, including those that use the personal context awareness and action capabilities of Apple Intelligence. Spotlight suggestions and search. Actions and automations in the Shortcuts app." ([9to5Mac](https://9to5mac.com/2025/09/22/macos-tahoe-26-1-beta-1-mcp-integration/))

The integration approach: **MCP support is being built INTO the App Intents framework**, not as a separate system. Developers expose capabilities through App Intents; the system handles MCP protocol compatibility. Apple does the "heavy lifting of ensuring protocol compatibility." ([mcp.directory](https://mcp.directory/blog/apple-prepares-revolution-mcp-integration-in-macos-ios-ipados))

**Caveat from 9to5Mac at the time**: "The code found today indicates that MCP support is still in its infancy."

### Phase 2: WWDC 2026 (iOS 27) — system-wide MCP, Siri 2.0 connects

WWDC 2026 (June 8, 2026) significantly escalated the commitment:

> "**Siri 2.0 and the Core AI routing layer can connect to MCP-compliant servers.**" ([chatforest.com WWDC 2026 keynote confirmed](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/))

> "The Model Context Protocol support first shipped in Xcode 26.3 (February 26, 2026) now **extends across iOS 27 and macOS 27**." ([chatforest.com](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/))

> "Siri and Apple Intelligence agents can **connect to any MCP server**, giving them access to tools far beyond what Apple builds natively." ([MindStudio](https://www.mindstudio.ai/blog/apple-wwdc-ai-strategy-siri-app-intents-mcp))

What Siri 2.0 can do that Siri 1.x could not: "sustained multi-turn conversation with web search, **on-screen awareness (reading the current app's context)**, file analysis (PDFs, photos, documents), **multi-step task execution across apps**, and code assistance. The old Siri is retired in iOS 27." ([chatforest.com](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/))

### The nuance: two directions of MCP

There are actually **two directions** of MCP integration, and they matter for a publisher:

1. **App Intents → MCP (outbound):** Apps expose their capabilities through App Intents; Apple's system-level MCP integration makes those same capabilities available to external MCP-compatible agents (Claude Desktop, ChatGPT, Cursor). **Developers expose once through App Intents; the system bridges to MCP.** ([ithinkdiff.com](https://www.ithinkdiff.com/apple-betas-lay-mcp-groundwork-for-agentic-ai/): "exposing actions through App Intents once could make them automatically usable by MCP-enabled AI agents in the future")

2. **Siri 2.0 → external MCP servers (inbound/consumption):** Siri 2.0 and the Core AI routing layer can **connect to MCP-compliant servers** — meaning Siri can consume tools/resources from external MCP servers a publisher operates. This is the direction that matters for a content publisher: **your MCP server exposing your content becomes reachable by Siri on the user's iPhone.** ([chatforest.com](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/); [MindStudio](https://www.mindstudio.ai/blog/apple-wwdc-ai-strategy-siri-app-intents-mcp))

### What's NOT yet clear (as of research date)

- Blake Crosley's April 2026 analysis stated: "Apple Intelligence does not call MCP tools, and external LLM agents cannot directly invoke App Intents." ([Blake Crosley: App Intents vs MCP](https://blakecrosley.com/blog/app-intents-vs-mcp-tools-frontier)) — This was written **before** WWDC 2026 (June 2026) confirmed system-wide MCP in iOS 27. The WWDC 2026 sources suggest Apple is now bridging this gap, but the exact mechanics of how Siri 2.0 discovers and connects to arbitrary external MCP servers (vs. system-bridged App Intents→MCP) needs verification against Apple's official iOS 27 documentation and session videos.
- Can Foundation Models (the on-device `LanguageModelSession`) call MCP tools? **No, not directly.** `LanguageModelSession.tools` accepts conformers to Apple's `Tool` protocol, not MCP tool servers. To bridge, you'd write a Foundation Models `Tool` whose `call()` method invokes an MCP client. Apple has not shipped a built-in adapter. ([Blake Crosley: Foundation Models FAQ](https://blakecrosley.com/blog/foundation-models-on-device-llm))
- The iOS 27 developer beta is live; consumer beta "later in 2026"; general availability ~September 2026. Siri AI features not launching in EU or China at WWDC 2026 (regulatory constraints). ([Medium: Mac O'Clock](https://medium.com/macoclock/your-ios-app-is-invisible-to-siri-without-app-intents-46781d98c120); [lushbinary.com](https://lushbinary.com/blog/wwdc-2026-announcements-ios-27-siri-developer-guide/))

### Verdict on the claim

> "Siri on your iPhone can interact with MCP servers or custom skills through Apple Shortcuts or native integrations like Apple's App Intents framework."

**TRUE, with the following precision:**
- ✅ **Siri ↔ App Intents**: Confirmed and mandatory. App Intents is the **only** way Siri reaches into third-party apps in iOS 27 (SiriKit deprecated). Shortcuts, Spotlight, Widgets all route through App Intents.
- ✅ **App Intents → MCP bridge**: Apple is building system-level MCP support into/alongside App Intents. Expose capabilities via App Intents → they become available to MCP-compatible agents.
- ✅ **Siri 2.0 → external MCP servers**: WWDC 2026 sources confirm "Siri 2.0 and the Core AI routing layer can connect to MCP-compliant servers." This means a publisher's MCP server can be reachable by Siri on the user's device.
- ⚠️ **Foundation Models ↔ MCP**: NOT directly. The on-device `LanguageModelSession` uses Apple's `Tool` protocol, not MCP. Bridging requires app-side adapter code.
- ⚠️ **Timeline**: iOS 27 developer beta live June 2026; consumer beta later 2026; GA ~September 2026. EU/China excluded at launch.

---

## 3. What this means for a content publisher — the full exposure stack

A publisher can now expose content to Siri / on-device AI through **multiple complementary channels**, each serving a different caller:

### Channel 1: App Intents + App Entities (if the publisher has an iOS app)

From [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/):
- **App Entities**: model articles, episodes, authors, topics as typed entities → contributed to the **Spotlight semantic index** for personal context understanding.
- **App Intents**: expose actions — "read article X", "play latest episode", "show today's tech news from [publisher]", "search articles about [topic]".
- **View Annotations API** (iOS 27): map on-screen views to entities → Siri can reference what the user is currently reading ("summarize this article", "share this with my editor").
- **App Intents 2.0** (iOS 27): streaming responses for long-running actions, multi-turn conversational follow-ups, richer entity types, `SyncableEntity` (entities sync across user's devices via iCloud), `EntityCollection` (performance over large datasets).
- **Shortcuts integration**: Apple Intelligence assembles automations from natural-language descriptions; publisher intents become building blocks. "When I open the [publisher] app, show me today's briefing" → chained from publisher intents.
- **Discoverability**: App Intents are available from installation; App Shortcuts donation + indexing surfaces them into Spotlight searches and Siri suggestions **based on user behavior**. The user never types a tool name. ([Blake Crosley: App Intents Are Apple's New API](https://blakecrosley.com/blog/app-intents-are-apples-new-api-to-your-app); [Apple Developer](https://developer.apple.com/apple-intelligence/))

**Critical WWDC 2026 point**: "An iOS app without App Intents is **invisible to Siri**." No App Intents = the Gemini-powered Siri cannot call into your app, route user requests to your actions, or surface your content. ([Medium: Mac O'Clock](https://medium.com/macoclock/your-ios-app-is-invisible-to-siri-without-app-intents-46781d98c120); [ecorpit.com](https://ecorpit.com/ios-27-app-intents-siri-ai-developer-guide-2026/))

### Channel 2: MCP server (publisher-operated, for external agents AND Siri 2.0)

A publisher exposes an MCP server providing:
- **Resources** (read-only): article metadata, episode metadata, author profiles, feed items — as URIs the AI client fetches.
- **Tools** (actions): "search articles", "get full text" (entitlement-gated), "get latest episodes", "subscribe to feed", "submit comment".
- **Prompts**: few-shot examples for interacting with the content.

**With iOS 27, Siri 2.0 can connect to this MCP server directly.** The user asks Siri "what did [publisher] say about [topic]?" → Siri 2.0's Core AI routing layer connects to the publisher's MCP server → retrieves content via tools/resources → presents to user. The publisher controls the channel: authentication, entitlement, logging, can block specific agents. ([chatforest.com](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/); [MindStudio](https://www.mindstudio.ai/blog/apple-wwdc-ai-strategy-siri-app-intents-mcp))

**For web-only publishers (no native app)**: the MCP server is the **primary path** to Siri 2.0 and to external AI clients (Claude Desktop, ChatGPT desktop, etc.). No App Intents needed; the MCP server IS the integration surface.

### Channel 3: Foundation Models Tool protocol (in-app on-device LLM)

If the publisher has an iOS app, it can use `LanguageModelSession` + `Tool` protocol to run **Apple's on-device 3B-parameter LLM** (iOS 26) or AFM 3 Core Advanced 20B multimodal sparse model (iOS 27) entirely on-device:
- Define tools like `search_articles(query:)`, `get_article_summary(id:)`, `get_user_reading_history()` as `Tool` conformers.
- The on-device LLM calls these tools during generation → fetches content from the app's local store or the publisher's API → reasons about it → presents a typed result.
- **No network round-trip, no data leaves the device.** The model is free (no per-token bill), offline-capable, privacy-preserving.
- iOS 27: Foundation Models framework opened to **any LLM provider** (cloud APIs, open-source local models, fine-tunes) via a public `LanguageModel` protocol. The publisher's app can use Apple's on-device model, Claude, Gemini, or any conforming model. ([dev.to: WWDC 2026 Foundation Models](https://dev.to/arshtechpro/wwdc-2026-apple-just-opened-the-foundation-models-framework-to-any-llm-provider-5ejn); [Apple Developer: FoundationModels](https://developer.apple.com/documentation/FoundationModels))

**This is where on-device personalization lives**: the app runs the LLM locally, the LLM calls tools that access the user's on-device reading history, the personalization happens entirely on-device.

### Channel 4: llms.txt (the AI-readable entry point)

`/llms.txt` (curated markdown index of high-value content) + `/llms-full.txt` (concatenated full content) at the publisher's domain root. Any AI agent (including on-device ones pointed at the URL) can fetch one file and get a structured guide to the site's content. ([agentpatterns.ai](https://www.agentpatterns.ai/standards/llms-txt/))

**Reality check**: no proven citation uplift; adoption ~10% even among tech-forward publishers; no major LLM provider confirmed reading it at inference time. Treat as **forward-compatible agent infrastructure**, not an SEO play. A stale/broken llms.txt is worse than none. ([agentpatterns.ai](https://www.agentpatterns.ai/standards/llms-txt/); [newtarget.com](https://www.newtarget.com/web-insights-blog/what-is-llms-txt/))

### Channel 5: schema.org / JSON-LD + semantic HTML

`Article`, `BlogPosting`, `NewsArticle`, `PodcastEpisode` schema with `author`, `publisher`, `datePublished`, `isAccessibleForFree` properties. Foundation for Spotlight indexing, Safari on-device content indexing, and any AI parser. Semantic, accessible HTML is the base layer under all of the above.

### Channel 6: RSS / ATProto PDS records

RSS as a machine-readable feed; ATProto PDS records (Standard.site) as signed, structured, firehose-distributed content. Both are consumable by AI agents that fetch structured data.

---

## 4. On-device personalization — how it actually works

### The architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLISHER                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ CMS /    │  │ PDS       │  │ MCP server   │  │ llms.txt  │  │
│  │ PDS      │  │ records   │  │ (resources + │  │ schema.org│  │
│  │          │  │ (Standard │  │  entitlement-│  │ RSS       │  │
│  │          │  │  .site)   │  │  gated tools)│  │           │  │
│  └──────────┘  └───────────┘  └──────┬───────┘  └───────────┘  │
│                                      │                           │
└──────────────────────────────────────┼───────────────────────────┘
                                       │ controlled channel
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 USER'S iPHONE (iOS 27)                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Siri 2.0 (Gemini-powered, 1.2T params)                  │    │
│  │  + Core AI routing layer                                 │    │
│  │  ├── Connects to publisher's MCP server (tools/resources)│    │
│  │  ├── Calls publisher's App Intents (if app installed)    │    │
│  │  ├── On-screen awareness (reads current app context)     │    │
│  │  ├── Multi-step task execution across apps               │    │
│  │  └── Personal context (Spotlight semantic index)         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Publisher App (if installed)                             │    │
│  │  ├── App Intents (Siri-callable actions)                 │    │
│  │  ├── App Entities (Spotlight-indexed content)            │    │
│  │  ├── Foundation Models LanguageModelSession              │    │
│  │  │   + Tool protocol (on-device 3B/20B LLM)             │    │
│  │  │   + Tools: search_articles, get_reading_history,     │    │
│  │  │            get_article_summary, rank_for_user         │    │
│  │  └── View Annotations (on-screen entity mapping)         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ON-DEVICE PERSONALIZATION                               │    │
│  │  ├── User's reading history (in app's local store)       │    │
│  │  ├── User's behavior graph (on-device, not sent to pub)  │    │
│  │  ├── Spotlight semantic index (App Entities)             │    │
│  │  ├── Foundation Models LLM ranks/filters publisher       │    │
│  │  │   content based on local behavior graph               │    │
│  │  └── Apple Intelligence "personal context" reads from    │    │
│  │      App Entities / on-device data, not cloud profiles   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  External AI clients (optional, user-selected)           │    │
│  │  ├── Claude Desktop / Claude Code → publisher MCP server │    │
│  │  ├── ChatGPT desktop → publisher MCP server              │    │
│  │  └── Any MCP-compatible agent → publisher MCP server     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### The personalization flow, step by step

1. **Publisher provides structured content substrate**: articles, episodes, authors, topics as typed data — via MCP server resources, App Entities, PDS records, RSS, schema.org. The content arrives on the device through one or more of the channels above.

2. **User's behavior graph accumulates on-device**: what articles they read, how deep they scrolled, what topics they engage with, time-of-day patterns, session arcs. This data lives in the **app's local store** and the **Spotlight semantic index** — not in a publisher server-side profile.

3. **Foundation Models LLM personalizes locally**: the publisher's app creates a `LanguageModelSession` with tools like `get_user_reading_history()`, `get_article_topic(id:)`, `rank_articles_for_user(topic:, history:)`. The on-device LLM calls these tools during generation → fetches the user's local behavior graph → ranks/filters the publisher's content → produces a personalized result. **The personalization computation happens on-device; the behavior data never leaves the device.**

4. **Siri 2.0 leverages personal context**: Apple Intelligence's "personal context" feature reads from App Entities and the Spotlight semantic index. If the publisher's articles are App Entities, Siri knows the user's reading history and can proactively suggest content ("you might want to read [publisher]'s follow-up to the article you read this morning"). The publisher doesn't need to build this — it comes free with App Entity adoption. ([Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/))

5. **Publisher receives only aggregated, consented signals**: the publisher's MCP server / API logs which content was requested (at an aggregate level), not individual behavioral profiles. The publisher's first-party analytics agent processes audience-level patterns ("topic X had high engagement this week") to inform editorial decisions. Individual personalization stays on-device.

### What you can personalize beyond "recommended articles"

With Foundation Models + Tool protocol on-device:
- **Adaptive UI**: the LLM can rank which topic verticals to surface on the home screen based on the user's reading history tool call → collapse sections they never open, expand sections they engage with deeply.
- **Progressive disclosure**: for a casual browser, show headline + summary; for a power reader who engages deeply with a topic, auto-expand the full analysis and related links. The LLM decides which level based on the user's on-device history.
- **Contextual deep-dives**: "you read 3 articles on [topic] this week — here's our deeper investigation that connects them."
- **Reading-flow optimization**: the LLM suggests the next article based on the current session arc (not just generic popularity) — "after this climate article, you might want the policy follow-up rather than the science explainer, based on what you usually read next."
- **Smart summaries**: the on-device LLM can summarize an article for the user (using `@Generable` typed output) — the summary is generated on-device from the publisher's content, not by a cloud AI summarizer. The publisher's content is consumed for the user's benefit, not scraped for an answer box.
- **Proactive surfacing via Siri**: App Shortcuts donation + Siri suggestions mean the publisher's content can appear in Siri's proactive suggestions based on user behavior — "Siri, what's new from [publisher]?" surfaces personalized results.

### The privacy-preserving split — why this is different from surveillance capitalism

| | **Old model (server-side profiling)** | **On-device personalization (iOS 27)** |
|---|---|---|
| Where behavior data lives | Publisher server + ad networks | User's device (app local store + Spotlight index) |
| Who computes personalization | Server (sends personalized page) | Device (on-device LLM ranks/filters) |
| What publisher sees | Individual user profiles, tracking data | Aggregated, consented signals only |
| Privacy | Poor (tracking, profiling, breaches) | Strong (data minimization, GDPR/CCPA-aligned) |
| Trust | Low (user feels watched) | High (user's AI serves the user) |
| Cost | Server compute + adtech infrastructure | Free on-device LLM (no per-token bill) |
| Works offline | No | Yes (Foundation Models is local) |

**The publisher's role shifts from "hoard user data to personalize server-side" to "provide structured content substrate; let the device personalize."** This is a fundamental architecture change — and it aligns with the death of third-party cookies, GDPR/CCPA data minimization, and user trust.

---

## 5. Ways Siri can leverage this that you might not think of

### 5A. Siri as a cross-app content router
With on-screen awareness + App Intents + MCP, Siri 2.0 can route content across apps: "Send this [publisher] article to my editor in Slack" → reads the on-screen article entity → extracts the canonical URL → sends via Slack's App Intent. The publisher's content becomes a first-class entity the system can move between apps. ([chatforest.com](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/); [Apple Developer](https://developer.apple.com/apple-intelligence/))

### 5B. Siri proactive suggestions based on reading patterns
Apple Intelligence's personal context reads from App Entities in the Spotlight semantic index. If a user reads [publisher] articles every morning at 7am, Siri can proactively suggest "Your morning [publisher] briefing is ready" — the publisher didn't build a push notification; the system inferred the pattern from App Entity engagement data. ([Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/): "Entity schemas contribute your content to the Spotlight semantic index for personal context understanding")

### 5C. Siri as a voice-driven content query layer
With the publisher's MCP server connected to Siri 2.0, the user can ask: "What's the latest from [publisher] on [topic]?" → Siri queries the MCP server's `search_articles` tool → gets results → reads back a summary or opens the article in the publisher's app. **The publisher's content is voice-queryable without the publisher building a voice interface.** ([chatforest.com](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/); [MindStudio](https://www.mindstudio.ai/blog/apple-wwdc-ai-strategy-siri-app-intents-mcp))

### 5D. Siri chained automations with publisher content
Shortcuts + Apple Intelligence assembles automations from natural-language descriptions. A user could say: "Every morning, read me the headline from [publisher], add any mentioned stocks to my watchlist, and text my boss a summary." Siri chains: publisher's `get_latest_headline` App Intent → Stocks app intent → Messages app intent. The publisher's content becomes a **building block in the user's automated workflows**. ([Apple Developer](https://developer.apple.com/apple-intelligence/); [ecorpit.com](https://ecorpit.com/ios-27-app-intents-siri-ai-developer-guide-2026/))

### 5E. On-device LLM summarization FOR the user (not for Google)
The Foundation Models on-device LLM can summarize the publisher's article for the user — "summarize this in 3 bullet points" — entirely on-device. **This is NOT Google Zero.** The summary is generated on the user's device, for the user's benefit, from content the publisher served (via app or MCP). The publisher's content is consumed; the user gets value; the publisher retains the relationship. No cloud AI scraped it for an answer box. The difference: **who runs the model and who benefits.** Cloud AI summarization benefits the intermediary (user never visits). On-device summarization benefits the user (user may still visit, and the publisher served the content through a controlled channel). ([Blake Crosley: Foundation Models](https://blakecrosley.com/blog/foundation-models-on-device-llm))

### 5F. RAG over the user's reading history
WWDC 2026 introduced **"LLM search using Core Spotlight"** — RAG (Retrieval-Augmented Generation) over the Spotlight index. The on-device LLM can search the user's Spotlight-indexed content (including publisher App Entities) to answer questions like "what was that article I read last week about [topic]?" — retrieving from the user's personal reading history. The publisher's content, once indexed as App Entities, becomes part of the user's searchable personal knowledge base. ([Apple Developer: WWDC26 Apple Intelligence guide](https://developer.apple.com/wwdc26/guides/apple-intelligence/); [blakecrosley.com](https://blakecrosley.com/blog/apple-foundation-models-framework))

### 5G. Siri Extensions — third-party AI providers in Siri
WWDC 2026 introduced the **Siri Extensions SDK** — third-party AI providers (Claude, Gemini, ChatGPT) can plug into Siri at the OS level. A publisher could theoretically build a Siri Extension that provides specialized content analysis (e.g., "use [publisher]'s fact-check engine on this claim"). ([buildmvpfast.com](https://www.buildmvpfast.com/blog/wwdc-2026-developer-announcements-ios-27-siri-preview): "Siri Extensions SDK lets third-party AI providers plug into Siri at the OS level")

### 5H. SyncableEntity — personalization syncs across devices
App Intents 2.0 in iOS 27 adds `SyncableEntity` — entities sync across the user's iCloud devices. A user's reading history on iPhone syncs to their Mac and iPad. The publisher's content entities follow the user across devices; personalization is consistent. ([lushbinary.com](https://lushbinary.com/blog/sirikit-to-app-intents-migration-guide/))

---

## 6. The publisher's implementation checklist

### If the publisher has an iOS app:
1. **Define App Entities** for articles, episodes, authors, topics → Spotlight semantic index → personal context.
2. **Define App Intents**: `search_articles`, `get_article`, `get_latest_episodes`, `play_episode`, `get_author_articles`, `submit_comment` (entitlement-gated).
3. **Add View Annotations** so Siri can reference on-screen content.
4. **Adopt Foundation Models** with `Tool` protocol for on-device personalization: `get_user_reading_history`, `rank_articles_for_user`, `get_article_summary`.
5. **Use `@Generable`** for typed structured output (summaries, recommendations).
6. **Ship an MCP server** (see below) so the same domain capabilities are reachable by external agents AND potentially Siri 2.0's Core AI routing.
7. **Adopt `SyncableEntity`** for cross-device entity sync.
8. **Donate App Shortcuts** so Siri proactively suggests content based on behavior.

### If the publisher is web-only (no native app):
1. **Ship an MCP server** exposing content as Resources (read-only metadata) + entitlement-gated Tools (full text, search). This is the **primary path** to Siri 2.0 and external AI clients.
2. **Publish `/llms.txt`** as a curated, maintained entry point for AI agents. Keep it current; a stale file is worse than none.
3. **Use schema.org JSON-LD** (`Article`, `PodcastEpisode`, `isAccessibleForFree`) for semantic structure.
4. **Keep RSS** as a universal machine-readable feed.
5. **Publish Standard.site records** to PDS for atproto-native distribution.
6. **Ensure semantic, accessible HTML** — the foundation under everything.

### For both:
- **Block cloud AI summarization scrapers** via `robots.txt` / `Google-Extended` — be machine-readable for the user's own agent, not for cloud answer boxes.
- **Entitlement-gate premium content** in the MCP server / App Intents — public metadata is freely available; full text requires authenticated, entitled access.
- **Collect only aggregated, consented analytics** — let individual personalization happen on-device.

---

## 7. What's real now vs. what's coming

| Capability | Status (as of July 2026) |
|-----------|-------------------------|
| App Intents → Siri | ✅ Shipping (iOS 16+, mandatory iOS 27) |
| App Entities → Spotlight personal context | ✅ Shipping |
| Foundation Models (on-device LLM + Tool protocol) | ✅ Shipping (iOS 26+, expanded iOS 27) |
| Foundation Models opened to any LLM provider | ✅ WWDC 2026 (iOS 27) |
| MCP in Xcode 26.3 | ✅ Shipping (Feb 2026) |
| System-wide MCP across iOS 27 / macOS 27 | 🔶 WWDC 2026 announced; developer beta live; GA ~Sept 2026 |
| Siri 2.0 connects to MCP-compliant servers | 🔶 WWDC 2026 confirmed; developer beta; consumer beta later 2026 |
| App Intents ↔ MCP system bridge | 🔶 Groundwork in iOS 26.1; system-wide in iOS 27 (details still emerging) |
| Siri Extensions SDK (third-party AI in Siri) | 🔶 WWDC 2026; developer beta |
| Siri AI in EU/China | ❌ Not at launch (regulatory) |
| Foundation Models ↔ MCP direct bridge | ❌ Not built; requires app-side adapter code |
| llms.txt as recognized standard | ⚠️ No proven citation uplift; voluntary compliance; ~10% adoption |

---

## 8. Synthesis — the sharpened picture

**Yes, Siri on iPhone can interact with MCP servers and custom skills through App Intents.** As of iOS 27 (WWDC 2026), this is confirmed and shipping in developer beta:

- **App Intents** is the mandatory path for Siri to reach into apps (SiriKit deprecated).
- **MCP support extends system-wide** in iOS 27; Siri 2.0's Core AI routing layer can connect to MCP-compliant servers.
- **The same Swift domain function** can serve App Intents (for Siri), Foundation Models `Tool` protocol (for in-app on-device LLM), and MCP tools (for external agents) — three thin adapters over one domain layer.
- **Foundation Models** gives the publisher's app a free, on-device, privacy-preserving LLM for personalization — the `Tool` protocol is how the model accesses the app's data and the user's behavior graph.

**For a content publisher, this means:**
1. Expose content via **App Entities + App Intents** (if you have an app) → Siri can search, surface, and act on your content; personal context uses your reading history.
2. Expose content via an **MCP server** (with or without an app) → Siri 2.0 and external AI clients can query your content through a controlled, entitlement-gated channel.
3. Use **Foundation Models + Tool protocol** for on-device personalization → the user's behavior graph stays on-device; the LLM ranks/filters your content locally; you get only aggregated signals.
4. Supplement with **llms.txt + schema.org + RSS + semantic HTML** as the AI-readable surface.
5. **Block cloud AI scrapers** — be machine-readable for the user's own agent, not for Google Zero.

**The personalization paradigm shifts**: from server-side profiling (surveillance capitalism) to on-device personalization (the user's AI serves the user, the publisher provides the content substrate). The publisher doesn't need to hoard user data. The publisher provides structured content; the device's LLM personalizes locally; the publisher gets consented aggregated signals. This is privacy-preserving, GDPR/CCPA-aligned, trust-building, and — critically — it serves the creator's ability to thrive by strengthening the publisher-reader relationship rather than intermediating it away.

---

## Sources

### Apple Developer / WWDC 2026
- [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/)
- [Apple Developer: FoundationModels framework](https://developer.apple.com/documentation/FoundationModels)
- [Apple Developer: WWDC26 Apple Intelligence guide](https://developer.apple.com/wwdc26/guides/apple-intelligence/)
- [Apple ML Research: Third Generation Foundation Models](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models)
- [Apple Developer: What's new in Foundation Models (WWDC26 video)](https://developer.apple.com/videos/play/wwdc2026/241/)

### MCP + Apple integration
- [9to5Mac: Apple working on MCP support](https://9to5mac.com/2025/09/22/macos-tahoe-26-1-beta-1-mcp-integration/)
- [AppleInsider: iOS 26 MCP boost](https://appleinsider.com/articles/25/09/22/ios-26-could-get-a-major-ai-boost-with-the-model-context-protocol)
- [mcp.directory: Apple Prepares Revolution](https://mcp.directory/blog/apple-prepares-revolution-mcp-integration-in-macos-ios-ipados)
- [ithinkdiff.com: Apple betas lay MCP groundwork](https://www.ithinkdiff.com/apple-betas-lay-mcp-groundwork-for-agentic-ai/)
- [heise online: MCP for Apple Intelligence](https://www.heise.de/en/news/AI-for-iOS-MCP-for-Apple-Intelligence-on-the-way-10670566.html)
- [computerworld: Apple MCP support](https://www.computerworld.com/article/4061614/apple-to-deploy-mcp-support-for-powerful-ai-experiences.html)
- [remio.ac: Apple Joins MCP Standard](https://www.remio.ac/post/apple-joins-mcp-standard-bridging-ai-models-with-ios-ipados-macos-ecosystem)
- [fatbobman: Apple System-Level MCP Support](https://fatbobman.com/en/weekly/issue-104/)

### WWDC 2026 coverage
- [chatforest.com: WWDC 2026 Keynote Confirmed](https://chatforest.com/builders-log/wwdc-2026-keynote-confirmed-apple-ai-platform-builder-guide/)
- [MindStudio: Apple's WWDC AI Strategy](https://www.mindstudio.ai/blog/apple-wwdc-ai-strategy-siri-app-intents-mcp)
- [aimadetools.com: WWDC 2026 AI Developer Recap](https://www.aimadetools.com/blog/wwdc-2026-ai-developer-recap/)
- [byteiota.com: Xcode 27 Agentic Coding MCP Guide](https://byteiota.com/xcode-27-agentic-coding-mcp-guide/)
- [techtimes.com: WWDC 2026 Day 3 — Xcode 27](https://www.techtimes.com/articles/318110/20260610/wwdc-2026-day-3-xcode-27-neural-engine-completes-code-without-sending-source-any-server.htm)
- [lushbinary.com: WWDC 2026 Announcements](https://lushbinary.com/blog/wwdc-2026-announcements-ios-27-siri-developer-guide/)
- [voiceos.com: iOS 27 Siri Leak](https://www.voiceos.com/blog/ios-27-siri-leak-ai-assistant)
- [buildmvpfast.com: WWDC 2026 Preview](https://www.buildmvpfast.com/blog/wwdc-2026-developer-announcements-ios-27-siri-preview)

### App Intents migration
- [techtimes.com: App Intents Replaces SiriKit](https://www.techtimes.com/articles/318005/20260608/wwdc-2026-app-intents-replaces-sirikit-gemini-siri-migration-clock-starts.htm)
- [lushbinary.com: SiriKit to App Intents Migration](https://lushbinary.com/blog/sirikit-to-app-intents-migration-guide/)
- [ecorpit.com: iOS 27 App Intents Developer Guide](https://ecorpit.com/ios-27-app-intents-siri-ai-developer-guide-2026/)
- [ecorpit.com: iOS 27 App Intents and AI agents strategy](https://ecorpit.com/ios-27-app-store-ai-agents-app-intents-developer-strategy-2026/)
- [Medium: Mac O'Clock — Your iOS app is invisible to Siri without App Intents](https://medium.com/macoclock/your-ios-app-is-invisible-to-siri-without-app-intents-46781d98c120)
- [techbetweenthelines.com: App Intents Are the New ASO](https://www.techbetweenthelines.com/app-intents-are-the-new-aso-how-siri-ai-will-discover-apps/)

### Blake Crosley technical analysis (deep)
- [App Intents vs MCP: The Routing Question](https://blakecrosley.com/blog/app-intents-vs-mcp-tools-frontier)
- [Foundation Models On-Device LLM: The Tool Protocol](https://blakecrosley.com/blog/foundation-models-on-device-llm)
- [App Intents Are Apple's New API to Your App](https://blakecrosley.com/blog/app-intents-are-apples-new-api-to-your-app)
- [Apple Foundation Models Framework Explained](https://blakecrosley.com/blog/apple-foundation-models-framework)
- [dev.to: WWDC 2026 Foundation Models opened to any LLM provider](https://dev.to/arshtechpro/wwdc-2026-apple-just-opened-the-foundation-models-framework-to-any-llm-provider-5ejn)
- [dev.to: Foundation Models Run AI On-Device](https://dev.to/arshtechpro/apples-foundation-models-framework-run-ai-on-device-with-just-a-few-lines-of-swift-lbp)

### llms.txt
- [agentpatterns.ai: llms.txt standard](https://www.agentpatterns.ai/standards/llms-txt/)
- [limy.ai: LLMs.txt in 2026](https://limy.ai/blog/llms.txt-in-2026-the-full-guide)
- [newtarget.com: llms.txt and AI access](https://www.newtarget.com/web-insights-blog/what-is-llms-txt/)
- [wix.com AI Search Lab: agentic llms.txt](https://www.wix.com/studio/ai-search-lab/llms-txt-files-for-agents)

### MCP spec / implementations
- [modelcontextprotocol.io: Resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [modelcontextprotocol.io: Architecture](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)
- [contentful.com: MCP server docs](https://www.contentful.com/developers/docs/tools/mcp-server/)
- [alien.club: What Is MCP? A Publisher's Guide](https://www.alien.club/blog/what-is-mcp-a-publisher-s-plain-english-guide-to-model-conte/)
- [zuplo.com: What Are MCP Resources?](https://zuplo.com/blog/mcp-resources)

### Apple Shortcuts MCP server (community)
- [mcp-container.com: mcp-server-siri-shortcuts](https://mcp-container.com/mcp/fe4c66df-589e-46f0-9183-c19a3549b48c)
- [skywork.ai: Apple Shortcuts MCP Server Deep Dive](https://skywork.ai/skypage/en/macos-ai-shortcuts/1980483698223075328)
