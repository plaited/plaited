# ATProto, Content Sites & an Agentic Future — Research

Exploring how content publishers (news/media/sites with podcasts, social syndication, cross-commenting) can use AT Protocol as a distribution backbone, employ agents (not chatbots) to thrive without Google referral traffic ("Google Zero"), and expose content to local/on-device AI on the publisher's terms.

## Briefs

| Part | Focus |
|------|-------|
| [Part 1](./part-1-atproto-content-sites-and-agentic-future.md) | ATProto fundamentals, Google Zero evidence, agent roles, cross-protocol commenting, target architecture |
| [Part 2](./part-2-permissioned-data-local-ai-on-device.md) | Bluesky DM sidestep, Permissioned Data roadmap, RSS for paywall previews, PDS-native CMS, exposing content to local/on-device AI (MCP, llms.txt, App Intents, schema.org), on-device personalization |
| [Part 3](./part-3-siri-app-intents-mcp-on-device-personalization.md) | Deep dive: Can Siri talk to MCP servers? Three-protocol stack (App Intents / Foundation Models / MCP), WWDC 2026 iOS 27 system-wide MCP, on-device personalization architecture, publisher implementation checklist |
| [Part 4](./part-4-shortcuts-safari-siri-reader-automation.md) | Shortcuts + Safari + Apple Intelligence: the reader-side content agent. RSS → summarize → Notes pipeline, shipping community shortcuts, iOS 27 natural language shortcut creation, notification-triggered automations |
| [Part 5](./part-5-monetization-agents-cloudflare-gateway.md) | The eighth agent role: monetization. Cloudflare Monetization Gateway + x402 (HTTP 402 stablecoin pay-per-request), Pay Per Crawl → Pay Per Use, Web Monetization / Interledger for human micropayments, the complete revenue stack for the agentic web |
| [Part 6](./part-6-plaited-you-discover-compressed-loop.md) | Plaited × you-discover: compressing discover → connect → compose → verify → ship into minutes. Five ways the stack's setup cost collapses when every step is agent-operable through plaited's primitives + ARD |
| [Part 7](./part-7-progressive-web-agents-rendering-layers.md) | Progressive web agents: supporting both plaited-native rendering (full power: frontier-verifiable push-UI) and A2UI/AG-UI alternative renderers (React/Vue/Flutter) from one behavioral program via the design spec's substrate-neutral vocabulary. The catalog as a deployed, renderer-agnostic registry |
| [Part 8](./part-8-modnet-bridge-structural-patterns.md) | The Modnet bridge: Jaffe's 2020 modnet structural patterns (five tags: scale, structure, mechanics, boundary, content type) map onto the stack — four already locked in the design spec, the fifth (content type) intentionally out of scope (lexicon layer). The modnet was the right vision, six years early; the agent stack is its agent-era, ATProto-era, x402-era implementation |

## Grounding

- ATProto technical facts grounded in atproto.com, docs.bsky.app, bluesky-social/atproto GitHub
- Publisher traffic / Google Zero data from Reuters Institute, Pew, Chartbeat, SparkToro/Datos, DCN, Nieman Lab, Press Gazette, Axios
- Apple Intelligence / App Intents from Apple Developer docs and WWDC 2026 coverage
- MCP from modelcontextprotocol.io spec and implementations

## Key findings

1. **ATProto is a real backbone for non-social publishing** — Standard.site lexicons + WordPress ATmosphere plugin already ship; custom lexicons enable any content type.
2. **Google Zero is the planning assumption** — Conde Nast assumes all search traffic will be zero; Chartbeat shows −33% globally; small publishers −60%.
3. **Agents serve the creator, not the intermediary** — seven non-chatbot agent roles: distribution, moderation, feed curation, entitlements, rights, analytics, provenance.
4. **"Not everything in the PDS"** — Bluesky sidestepped DMs to a sidecar service; the Spring 2026 Roadmap formalizes "Permissioned Data" (non-public data with explicit access control).
5. **RSS + ATProto coexist** — token-gated private RSS (podcasting pattern) maps to public PDS record + private entitlement-gated full text.
6. **Controlled local-AI exposure** — MCP server + llms.txt + App Intents + schema.org as a coordinated "AI-readable" surface for the user's own on-device AI, distinct from cloud-AI-scrapable web.
7. **On-device personalization** — publisher provides structured content substrate; the user's device personalizes locally; publisher gets only consented aggregated signals.
8. **Siri ↔ MCP is real (iOS 27)** — WWDC 2026 confirmed system-wide MCP support; Siri 2.0's Core AI routing layer connects to MCP-compliant servers; App Intents is the mandatory Siri integration path; Foundation Models provides on-device LLM with Tool protocol for in-app personalization.
9. **Shortcuts + Safari = reader-side content agent** — shipping community shortcuts (News Report AI) fetch RSS, extract via Safari Reader, summarize with on-device Apple Intelligence, save to Notes — no publisher app required; iOS 27 adds natural language shortcut creation.
10. **Monetization is the eighth agent role** — Cloudflare Monetization Gateway + x402 enables pay-per-request for agent consumption (stablecoin, sub-second, no account needed); Web Monetization/Interledger handles human micropayments; the publisher gets paid by the software that uses its work, completing the "thrive without Google" thesis.
11. **Plaited + you-discover compresses the stack to minutes** — discover (ARD) → connect/validate (`plaited mcp-client`) → compose (`behavioral` runtime) → ship (push-UI Controller/Renderer) → verify (`verifyFrontiers`) → reuse (`SKILL.md`) → pay (`@x402`) is a fully agent-operable loop; a developer goes from zero to a running, agent-readable, monetizable content site in minutes, not hours.
12. **Both rendering flows are supportable** — the design spec's functional vocabulary (affordances/feedback/patterns) is already substrate-neutral in description; plaited-native (Controller/Renderer push-UI, frontier-verifiable) is the full-power path, A2UI/AG-UI emission (React/Vue/Flutter/Lit) is the bring-your-own-renderer path. The agent plugin is renderer-agnostic; the behavioral program emits UI intent in the shared vocabulary; the rendering tail is a pluggable adapter. The catalog (deployed, not in the skill layer) registers both MCP servers and rendering alternatives.
13. **The Modnet's structural patterns are the design spec's vocabulary** — Jaffe's 2020 Modnet Structural Standard (MSS) defined five tags (scale, structure, mechanics, boundary, content type); four are already locked in the design spec (`p-scale`, `patterns:`, `affordances:`/`feedback:`, `patterns:` Boundary attribute), with provenance now documented in the spec. The fifth (content type) is intentionally out of scope — it's the lexicon/content-type layer (ATProto NSIDs). The modnet was the right vision, six years early, missing the agent operator and the payment rail; the stack is its agent-era, ATProto-era, x402-era implementation.
