# Shortcuts, Safari & Siri 2.0 — The Reader-Side Automation Pipeline

*Part 4 of the ATProto content-sites research.* Grounded in Apple Developer docs, MacNative Shortcuts action reference, Apple Support, WWDC 2026 coverage, and shipping community shortcuts.

---

## The constraint, restated

From Part 3: a content provider has two paths to expose content to Siri/on-device AI — either ship an **MCP server** (reachable by Siri 2.0 directly in iOS 27) or build a **lightweight wrapper app** with App Intents/App Entities. But there's a **third path that doesn't require the publisher to build anything at all**: the reader's own iPhone, using **Shortcuts + Safari actions + Apple Intelligence**, can fetch, extract, and summarize the publisher's content on a schedule — entirely on-device, for the reader's benefit.

This is the line of inquiry: **what can the reader do with Shortcuts + Safari + Siri 2.0, and what's new?**

---

## 1. The Shortcuts web/Safari action palette (already shipping)

iOS Shortcuts includes a rich set of web and Safari actions that can fetch, extract, and process web content — no app install required, no publisher cooperation required. ([MacNative: Default Web Actions](https://macnative.com/list-of-default-web-actions-for-ios-shortcuts/); [MacNative: Safari Actions](https://macnative.com/list-of-safari-actions-for-ios-shortcuts/))

### Content fetching
| Action | What it does |
|--------|-------------|
| **Get Items from RSS Feed** | Downloads the latest items from an RSS feed |
| **Get RSS Feeds from Page** | Extracts any RSS feed URLs from a web page |
| **Get Contents of Web Page** | Extracts the contents of input Safari web pages |
| **Get Contents of URL** | Gets the contents of input URLs (HTTP request — useful for APIs, downloads) |
| **Get Article using Safari Reader** | Gets article details — body text, author, publish date, and more — from input URLs (uses Safari's Reader mode parsing) |
| **Get Headers of URL** | Returns HTTP headers (HEAD request) |

### Content processing
| Action | What it does |
|--------|-------------|
| **Filter Articles** | Returns articles matching given criteria from an input list |
| **Get Details of Article** | Gets a specific piece of information from input articles |
| **Get Details of Safari Web Page** | Gets a specific piece of information from Safari web pages |
| **Get URLs from Input** | Returns any URLs in the input |
| **Expand URL** | Expands/cleans up shortened URLs |
| **Get Component of URL** | Gets a specified part of the input URL |

### JavaScript execution
| Action | What it does |
|--------|-------------|
| **Run JavaScript on Web Page** | Runs JavaScript on an input Safari web page — can extract any DOM content, interact with the page, scrape structured data |

### Safari control
| Action | What it does |
|--------|-------------|
| **Show Web View** | Displays input URL in a Safari View Controller (in-app) |
| **Open URLs** | Opens input URLs in default browser |
| **Add to Reading List** | Adds input URLs to Safari Reading List |
| **Listen to Page** | Asks Siri to read the article contents in Safari (if available) |

### The key insight
These actions let a Shortcut **act as a web scraping + content extraction engine** — fetching RSS, loading pages, extracting article text via Safari Reader, running arbitrary JavaScript, and processing the results. Combined with Apple Intelligence (below), the Shortcut becomes a **reader-side content agent**.

---

## 2. The "Use Model" action — Apple Intelligence in Shortcuts (iOS 26+, expanded iOS 27)

The **"Use Model"** action, introduced in iOS 26, is the transformative addition. It lets any Shortcut call Apple's on-device or cloud LLM as a step in the workflow. ([Apple Support: Use Apple Intelligence in Shortcuts](https://support.apple.com/guide/iphone/use-apple-intelligence-in-shortcuts-iph78c41eaf8/26/ios/26); [AppleInsider](https://appleinsider.com/inside/ios-26/tips/how-to-use-apple-intelligence-in-shortcuts-to-save-time-every-day))

### Three model modes
| Mode | Where it runs | Privacy | Capability | Speed |
|------|--------------|---------|------------|-------|
| **On-Device** | Apple's 3B Foundation Model on the device | Full — data never leaves device | Limited (smaller model, shorter context) | Fastest |
| **Private Cloud Compute** | Apple's server-side model | Strong — data processed on Apple's privacy-preserving cloud, not stored | More capable (larger model, longer context) | Moderate |
| **ChatGPT Extension** | OpenAI's model (optional) | Leaves Apple ecosystem | Most capable (frontier model) | Depends on network |

### What "Use Model" can do in a Shortcut
- **Summarize**: "Summarize in 3 bullets", "Three-sentence summary", "Single paragraph overview"
- **Extract**: "Extract the key argument", "What are the main claims?"
- **Transform**: "Rewrite in plain language", "Translate to [language]"
- **Generate**: "Suggest 3 follow-up questions", "Write a tweet about this"
- **Classify**: "Is this relevant to [topic]?", "Rate this article's importance 1-10"
- **Custom prompt**: any free-text instruction piped to the model

### Output handling
- The model's response is **automatically optimized for the action it's passed to**.
- You can control how the response outputs: tap the **Output** menu on the Use Model action.
- **Follow Up** checkbox: lets you interactively refine the response ("make it shorter", "change the tone") before the Shortcut continues — no need to edit the Shortcut itself. ([AppleInsider](https://appleinsider.com/inside/ios-26/tips/how-to-use-apple-intelligence-in-shortcuts-to-save-time-every-day))

### iOS 27 enhancements (WWDC 2026)
- **"Use Model" with web retrieval**: the model can now search the web for up-to-date information mid-Shortcut. "The Use Model action has access to the latest Apple Intelligence models with web retrieval." ([Apple Developer: What's New in Shortcuts WWDC26](https://developer.apple.com/videos/play/wwdc2026/310/))
- **Cloud, Cloud Pro, and on-device models** available in Shortcuts. "Cloud Pro is able to search the web, and is used for queries that need information from the internet." ([MacRumors](https://www.macrumors.com/guide/ios-27-shortcuts/))
- **Shortcuts can store and update data** — add items to a list, keep a tally, maintain state across runs. ([MacRumors](https://www.macrumors.com/guide/ios-27-shortcuts/))

---

## 3. What's new in iOS 27 Shortcuts (WWDC 2026)

### Natural language shortcut creation
The biggest change: **you describe what you want in plain English, and Apple Intelligence builds the Shortcut for you.** No manual action-stacking. ([MacRumors](https://www.macrumors.com/guide/ios-27-shortcuts/); [ithinkdiff.com](https://www.ithinkdiff.com/ios-27-shortcuts-natural-language-creation/); [allthings.how](https://allthings.how/shortcuts-in-ios-27-will-build-automations-from-plain-english/))

> "You just type what you want, in plain sentences, and the shortcut builds itself. Apple demonstrated someone typing a request to automatically send their ETA to a contact whenever they leave home. Apple Intelligence reads the sentence, identifies the necessary pieces, and assembles the entire workflow behind the scenes." ([gotechtor.com](https://www.gotechtor.com/ios-27-shortcuts-natural-language-automation-apple-intelligence/))

**For a content publisher's reader**: the reader types "Every morning at 7am, get the latest articles from [publisher]'s RSS feed, summarize each one in 3 sentences, and save them to a note called Daily Briefing" → Apple Intelligence assembles the entire Shortcut from Safari + RSS + Use Model + Notes actions. **The reader doesn't need to know Shortcuts; they just describe the workflow.**

### New automation triggers (iOS 27)
iOS 27 adds three new automation types: ([Apple Developer: What's New in Shortcuts WWDC26](https://developer.apple.com/videos/play/wwdc2026/310/))
- **Screenshot**: trigger a Shortcut when the user takes a screenshot
- **Keyboard connection**: trigger when a keyboard is connected/disconnected
- **Notification**: **fine-grained, keyword-filtered triggers based on notification content** — a Shortcut can trigger when a specific app sends a notification containing specific keywords

**Publisher implication**: if the publisher's app (or any app) sends a push notification about a new article, the reader's Shortcut can auto-trigger on that notification — e.g., "when [publisher] sends a notification containing 'breaking', fetch the article and summarize it." This is a **notification-driven content pipeline**.

### Automations are no longer a separate section
In iOS 27, automation triggers are under the general Shortcuts actions — "automation is no longer a separate section in the Shortcuts app." ([MacRumors](https://www.macrumors.com/guide/ios-27-shortcuts/)) This makes it easier to add triggers to any Shortcut.

### Existing automation triggers (still available)
- **Time of day** (e.g., every day at 7am)
- **Location** (arrive/leave a place)
- **App opened** (when you open a specific app)
- **Charging state** (when connected/disconnected from charger)
- **Battery level**
- **Specific contact calls**
- **Message received** (with content filters)
- **Email received** (with sender/subject filters)
- **Sleep tracking** (wind down/wake up)

---

## 4. The shipping proof — "News Report AI" and similar shortcuts

This isn't theoretical. There are already **community-built, shipping Shortcuts** that do exactly this:

### News Report AI (Stephen Robles / Shortcuts community)
The flagship example. ([Cult of Mac](https://www.cultofmac.com/guide/13-mind-blowing-ios-26-shortcuts-with-apple-intelligence); [beard.fm deep dive](https://wiki.beard.fm/whats-new-apple-intelligence-in-shortcuts/deep-dive-into-creating-a-daily-news-report-with-rss-feeds))

**The pipeline:**
1. **Get 50 items from RSS Feed** — fetches 50 recent items from a specified RSS feed (e.g., CNN, NYT, any publisher)
2. **Filter RSS Items** — narrows to only articles published **today**
3. For each article: **Get Article using Safari Reader** (or Get Contents of Web Page) — extracts the full body text
4. **Use Cloud model** (Apple Intelligence) — generates a concise **3-sentence summary** of each article
5. **Combine** — article title + image + summary + original URL into a new **Apple Note**
6. **Automate** — set to run at a specific time each day

> "The News Report AI shortcut pulls news directly from RSS feeds and saves them to an Apple note. For example, you can tell it to get 50 items from the CNN homepage feed and filter them based on time. Apple Intelligence will summarize all the articles and create a note with the header image, summary, full text and a link to the source. You can automate it to run at specific times of the day." ([Cult of Mac](https://www.cultofmac.com/guide/13-mind-blowing-ios-26-shortcuts-with-apple-intelligence))

**Customization:**
- Swap the RSS feed URL for any publisher's feed
- Reduce the number of articles for speed
- Switch from Cloud model to **On-Device model** for privacy and speed (quality may vary)
- Set as a daily automation → wake up to a curated news digest in Notes

### Tech News Aggregator
> "The Tech News Aggregator shortcut automates that entire process. It pulls up to 50 items per day from your selected tech RSS feeds. It then sends those articles to ChatGPT through the Apple Intelligence action. Open the shortcut and add your preferred RSS feeds to the top Text block. Set the publish date filter to 'in the last 1 day' so you only get fresh news. Run the shortcut. It will generate a clean Apple Note containing the titles, summaries, and source links for the day's top stories." ([beard.fm](https://wiki.beard.fm/whats-new-apple-intelligence-in-shortcuts/how-to-build-an-ai-powered-news-aggregator-with-apple-shortc))

### Save for Later
> "It can handle websites, social media posts, news articles and YouTube videos. In a nutshell, it will save all the contents from the source to Apple Notes. You'll see the title, a quick summary and a link." ([Cult of Mac](https://www.cultofmac.com/guide/13-mind-blowing-ios-26-shortcuts-with-apple-intelligence))

### Summarize Doc AI
Summarizes any document via Share Sheet — 3-sentence summary with key points. Three model options: ChatGPT, On-Device, Cloud. ([Cult of Mac](https://www.cultofmac.com/guide/13-mind-blowing-ios-26-shortcuts-with-apple-intelligence))

---

## 5. What the reader can build — concrete workflows

### Workflow A: Daily publisher briefing (RSS → summarize → Notes)
```
Trigger: Every day at 7:00 AM
  │
  ▼
Get Items from RSS Feed (publisher.com/feed.xml, 50 items)
  │
  ▼
Filter Articles (published today)
  │
  ▼
Repeat with each article:
  ├── Get Article using Safari Reader (extract full text)
  ├── Use Model (On-Device): "Summarize in 3 sentences"
  └── Append to Note: title + summary + URL
  │
  ▼
Create Note: "Daily [Publisher] Briefing — [Date]"
```
**iOS 27 version**: reader just types "Every morning at 7, get the latest from [publisher]'s RSS feed, summarize each article in 3 sentences, and save to a note called Daily Briefing" → Apple Intelligence builds it.

### Workflow B: Safari article summarizer (Share Sheet trigger)
```
Trigger: Share Sheet (from Safari)
  │
  ▼
Get Article using Safari Reader (from current page)
  │
  ▼
Use Model (On-Device): "Summarize the key arguments in 5 bullet points"
  │
  ▼
Show result (Quick Look) + optionally Save to Notes
```
Reader browsing a publisher's site → taps Share → runs the Shortcut → gets an on-device summary without leaving Safari.

### Workflow C: Notification-triggered breaking news
```
Trigger: Notification received from [Publisher App] containing "breaking"
  │
  ▼
Get URLs from Input (extract article URL from notification)
  │
  ▼
Get Article using Safari Reader
  │
  ▼
Use Model (On-Device): "Summarize this breaking news in 2 sentences"
  │
  ▼
Send Message (to [contact]) or Save to Notes
```
**iOS 27 only** — notification-triggered automation with keyword filtering. The reader gets an instant on-device summary of breaking news pushed to their phone.

### Workflow D: Topic monitoring across publishers
```
Trigger: Every day at 8:00 AM
  │
  ▼
Get Items from RSS Feed (publisher1.com/feed — 30 items)
Get Items from RSS Feed (publisher2.com/feed — 30 items)
Get Items from RSS Feed (publisher3.com/feed — 30 items)
  │
  ▼
Combine items
  │
  ▼
Filter Articles (published today AND title contains "[topic]")
  │
  ▼
Repeat with each article:
  ├── Get Article using Safari Reader
  ├── Use Model (On-Device): "Extract the key claim about [topic] in 1 sentence"
  └── Append to Note
  │
  ▼
Create Note: "[Topic] Monitor — [Date]"
```
The reader monitors a specific topic across multiple publishers' RSS feeds, gets a daily digest of only articles about that topic.

### Workflow E: Podcast episode processor
```
Trigger: Every day at 6:00 AM
  │
  ▼
Get Items from RSS Feed (podcast RSS — 10 items)
  │
  ▼
Filter Articles (published in last 2 days)
  │
  ▼
Repeat with each episode:
  ├── Get Details of Article (title, description, duration, audio URL)
  ├── Use Model (On-Device): "Based on the episode title and description, summarize what this episode covers in 2 sentences and rate my likely interest based on topics I follow: [list]"
  └── Append to Note: episode title + summary + interest rating + link
  │
  ▼
Create Note: "Podcast Briefing — [Date]"
```
The reader gets a daily podcast briefing — each new episode summarized and rated for likely interest, all on-device.

### Workflow F: Read-it-later with AI processing
```
Trigger: Share Sheet (from any app, any URL)
  │
  ▼
Get Article using Safari Reader
  │
  ▼
Use Model (On-Device): "Summarize in 3 bullets + extract 2 key quotes + suggest 1 follow-up question"
  │
  ▼
Save to Notes (folder: "Read Later AI")
```
Reader shares any article to the Shortcut → gets summary, key quotes, and a follow-up question, all saved to Notes.

---

## 6. What's new — the iOS 27 delta

| Capability | iOS 26 (now) | iOS 27 (WWDC 2026) |
|-----------|-------------|---------------------|
| Use Model action | ✅ On-device, Cloud, ChatGPT | ✅ + web retrieval, Cloud Pro |
| Natural language shortcut creation | ❌ | ✅ Describe in plain English → built automatically |
| Automation triggers | Time, location, app, charging, etc. | + screenshot, keyboard, **notification (keyword-filtered)** |
| Automations UI | Separate section | Integrated into general Shortcuts actions |
| Shortcuts data storage | Limited | ✅ Store/update data, keep tallies, add to lists |
| Use Model + web search | ❌ (model only knows what it's told) | ✅ Model can search web for current info mid-Shortcut |

**The iOS 27 step-change**: the reader no longer needs to be a "power user" who manually stacks actions. They **describe what they want** — "every morning, get [publisher]'s latest, summarize it, and tell me if there's anything about [topic]" — and Apple Intelligence assembles the Shortcut. Plus, the model can now **search the web** for up-to-date information, not just process what's passed to it.

---

## 7. The publisher's role — what makes this work

The reader's Shortcut can only work well if the publisher's content is **machine-extractable**. Here's what the publisher should do:

### 1. Publish a clean RSS feed
- Full or useful partial text (not just a headline + link — Safari Reader needs something to extract)
- Stable item IDs and canonical URLs
- Publication dates (so `Filter Articles` by date works)
- Author, categories, tags
- Episode metadata for podcasts (title, description, duration, audio URL)

### 2. Ensure Safari Reader-compatible HTML
- Semantic HTML (`<article>`, `<h1>`, `<time>`, `<author>`)
- Clean article structure (Safari Reader parses this to extract body text, author, publish date)
- Avoid JavaScript-rendered content (Reader needs server-rendered HTML)
- `schema.org` JSON-LD (`Article`, `NewsArticle`, `BlogPosting`) helps extraction

### 3. Make content accessible without paywall blockers for previews
- RSS should carry at least a useful excerpt (title + summary + first paragraph)
- If full text is paywalled, the RSS preview should be substantive enough for a useful on-device summary
- Token-gated premium RSS (Part 2) for full-text access by subscribers

### 4. Optionally: publish a Shortcut
The publisher can **build and share a Shortcut** pre-configured for their feed — readers download it and it works out of the box. This is the lightest-weight "app" a publisher can ship: a Shortcut file that fetches their RSS, summarizes with on-device AI, and delivers to Notes. No App Store, no native app, no MCP server — just a Shortcut the reader installs in one tap. ([thenextweb.com](https://thenextweb.com/news/how-to-create-a-simple-rss-feed-reader-on-ios): "make it easier to open your favorite Apple Music playlist... But one of its best uses in my opinion is use it as an RSS reader")

### 5. The llms.txt / schema.org layer (from Part 3)
All of this is enhanced if the publisher's site has semantic structure, schema.org, and clean HTML. The reader's "Get Article using Safari Reader" and "Get Contents of Web Page" actions work better with well-structured content.

---

## 8. The critical distinction — this is NOT Google Zero

| | **Reader's on-device Shortcut summarization** | **Google AI Overviews / cloud AI summarization** |
|---|---|---|
| Who benefits | The reader (their own AI summarizes for them) | The intermediary (answers extracted, user doesn't visit) |
| Where it runs | On the reader's device (Apple Intelligence on-device or Private Cloud Compute) | Cloud server (Google/OpenAI) |
| Publisher control | Publisher controls the RSS feed and content structure | Little (scraped, summarized, cited-or-not) |
| Source link | ✅ Preserved in the Note (reader can click through) | Often buried/uncited |
| Data flow | Publisher RSS → reader's device → on-device summary | Publisher → cloud → user (extracted) |
| Relationship | Strengthens publisher-reader (reader chose to subscribe to this feed) | Intermediates it away |
| Traffic | Reader may click through to full article | Reader never visits |

**The reader's Shortcut is an agent that works FOR the reader, on the reader's device, consuming content the reader chose to subscribe to.** The publisher's content is consumed through a channel the publisher controls (RSS). The summary is generated locally. The source link is preserved. The reader can still visit the site. This is the opposite of Google Zero, where a cloud AI scrapes the content, summarizes it on its server, and the user never visits.

---

## 9. Synthesis — the reader-side content agent

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLISHER (no app required, no MCP server required)       │
│  ├── Clean RSS feed (full or partial text)                │
│  ├── Semantic HTML (Safari Reader-compatible)             │
│  ├── schema.org JSON-LD                                   │
│  └── Optionally: a shared Shortcut pre-configured for feed │
└──────────────────────────┬──────────────────────────────────┘
                           │ RSS / web
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  READER'S iPHONE                                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Shortcuts (iOS 26 now, iOS 27 enhanced)             │    │
│  │  ├── Get Items from RSS Feed (publisher's feed)      │    │
│  │  ├── Filter Articles (today, topic, etc.)            │    │
│  │  ├── Get Article using Safari Reader (extract text)  │    │
│  │  ├── Run JavaScript on Web Page (if needed)          │    │
│  │  ├── Use Model (On-Device / Cloud / ChatGPT):        │    │
│  │  │   ├── Summarize in 3 sentences                    │    │
│  │  │   ├── Extract key claims                          │    │
│  │  │   ├── Rate relevance to my interests              │    │
│  │  │   ├── Suggest follow-up questions                 │    │
│  │  │   └── [any custom prompt]                         │    │
│  │  └── Save to Notes / Send Message / Show             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Automation Triggers                                  │    │
│  │  ├── Time of day (e.g., 7am daily)                   │    │
│  │  ├── Location (arrive home)                          │    │
│  │  ├── Notification received (iOS 27, keyword-filtered)│    │
│  │  ├── Share Sheet (manual, from Safari)               │    │
│  │  └── [any trigger]                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  iOS 27: Natural Language Shortcut Creation         │    │
│  │  "Every morning, get [publisher]'s latest,          │    │
│  │   summarize each in 3 sentences,                     │    │
│  │   and save to Daily Briefing note"                   │    │
│  │  → Apple Intelligence builds the Shortcut            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Apple Intelligence (on-device)                      │    │
│  │  ├── 3B Foundation Model (iOS 26)                   │    │
│  │  ├── AFM 3 Core Advanced 20B (iOS 27)               │    │
│  │  ├── Private Cloud Compute (heavier tasks)           │    │
│  │  └── Web retrieval (iOS 27)                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Output                                               │    │
│  │  ├── Apple Note (daily briefing)                     │    │
│  │  ├── Message (to contact)                            │    │
│  │  ├── Email                                             │    │
│  │  ├── Quick Look (show result)                        │    │
│  │  └── [any Shortcuts action]                           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### The reader gets:
- A **personalized daily briefing** from the publishers they choose, summarized on-device
- **Topic filtering** across multiple publishers
- **Notification-triggered** breaking news summaries
- **Share Sheet** summarization of any article they encounter
- **Privacy** — the summarization happens on their device; their reading preferences aren't sent to a server
- **Source links preserved** — they can click through to the full article
- **No app install required** — just Shortcuts (pre-installed) + the publisher's RSS feed
- **iOS 27**: describe what they want in plain English → the Shortcut builds itself

### The publisher gets:
- **Distribution without an app** — RSS + semantic HTML is all the reader needs
- **Distribution without Google** — the reader subscribes directly to the feed; no search intermediary
- **An optional lightest-weight "app"** — a shared Shortcut pre-configured for their feed
- **Reader engagement on the reader's terms** — the reader's device summarizes for them; the source link is preserved; the reader may visit
- **A path to deeper integration** — if the publisher later ships an MCP server (Part 3) or a native app with App Intents (Part 3), the reader can upgrade; but the RSS + Shortcuts path works today with zero publisher engineering

### What's genuinely new (the iOS 27 step-change):
1. **Natural language shortcut creation** — the reader doesn't need to be a power user. They describe the workflow; Apple Intelligence builds it.
2. **Use Model with web retrieval** — the model can search the web mid-Shortcut, not just process what's passed to it.
3. **Notification-triggered automations** with keyword filtering — publisher push notifications can auto-trigger content processing.
4. **Shortcuts can store/update data** — maintain reading lists, tallies, state across runs.
5. **Foundation Models on any device** — iOS 27 opens Foundation Models to any LLM provider; the publisher could theoretically ship a custom model conforming to the `LanguageModel` protocol.

---

## Sources

### Apple Developer / official
- [Apple Support: Use Apple Intelligence in Shortcuts](https://support.apple.com/guide/iphone/use-apple-intelligence-in-shortcuts-iph78c41eaf8/26/ios/26)
- [Apple Developer: What's New in Shortcuts WWDC26](https://developer.apple.com/videos/play/wwdc2026/310/)
- [Apple Developer: What's New iOS](https://developer.apple.com/ios/whats-new/)
- [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/)

### Shortcuts action reference
- [MacNative: Default Web Actions for iOS Shortcuts](https://macnative.com/list-of-default-web-actions-for-ios-shortcuts/)
- [MacNative: Safari Actions for iOS Shortcuts](https://macnative.com/list-of-safari-actions-for-ios-shortcuts/)

### iOS 26 Apple Intelligence in Shortcuts
- [AppleInsider: How to use Apple Intelligence in Shortcuts](https://appleinsider.com/inside/ios-26/tips/how-to-use-apple-intelligence-in-shortcuts-to-save-time-every-day)
- [beard.fm: Deep dive into summarizing documents, web pages, and news articles](https://wiki.beard.fm/whats-new-apple-intelligence-in-shortcuts/deep-dive-into-summarizing-documents-web-pages-and-news-arti)
- [beard.fm: Deep dive into creating a daily news report with RSS feeds](https://wiki.beard.fm/whats-new-apple-intelligence-in-shortcuts/deep-dive-into-creating-a-daily-news-report-with-rss-feeds)
- [Cult of Mac: 13 mind-blowing iOS 26 shortcuts with Apple Intelligence](https://www.cultofmac.com/guide/13-mind-blowing-ios-26-shortcuts-with-apple-intelligence)
- [Medium: Building an AI Daily Briefing with Apple Intelligence and Shortcuts](https://medium.com/@mathanamohans2003/apple-insides-tips-building-an-ai-daily-briefing-with-apple-intelligence-and-shortcuts-c39839d8bd6f)

### iOS 27 Shortcuts
- [MacRumors: iOS 27 Makes the Shortcuts App Much Less Intimidating](https://www.macrumors.com/guide/ios-27-shortcuts/)
- [ithinkdiff.com: Shortcuts in iOS 27 — natural language creation](https://www.ithinkdiff.com/ios-27-shortcuts-natural-language-creation/)
- [allthings.how: Shortcuts in iOS 27 Will Build Automations From Plain English](https://allthings.how/shortcuts-in-ios-27-will-build-automations-from-plain-english/)
- [gotechtor.com: iOS 27 Shortcuts natural language automation](https://www.gotechtor.com/ios-27-shortcuts-natural-language-automation-apple-intelligence/)
- [theapplebyte.net: iOS 27's Apple Intelligence Crafts Custom Shortcuts](https://theapplebyte.net/ios-27-apple-intelligence-custom-shortcuts/)

### RSS / news aggregator shortcuts
- [beard.fm: How to Build an AI-Powered News Aggregator with Apple Shortcuts](https://wiki.beard.fm/whats-new-apple-intelligence-in-shortcuts/how-to-build-an-ai-powered-news-aggregator-with-apple-shortc)
- [thenextweb.com: How to create a simple RSS feed reader on iOS](https://thenextweb.com/news/how-to-create-a-simple-rss-feed-reader-on-ios)
- [Pushcut: RSS Feeds Widget](https://www.pushcut.io/guides/widgets/rss)

### Foundation Models
- [chatforest.com: Apple Foundation Models in iOS 27 Builder Guide](https://chatforest.com/builders-log/apple-foundation-models-ios-27-on-device-llm-api-builder-guide/)
- [blakecrosley.com: Apple Foundation Models Framework Explained](https://blakecrosley.com/blog/apple-foundation-models-framework)
