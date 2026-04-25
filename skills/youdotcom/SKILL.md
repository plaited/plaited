---
name: youdotcom
description: >
  Use You.com Search, conditional livecrawl/contents, and narrow Research API
  follow-ups through the official client first, with direct HTTP only as
  fallback.

  - MANDATORY TRIGGERS: You.com, youdotcom, YDC, YDC API, You.com API,
  livecrawl, contents, research lite, research deep, cited web research,
  direct API integration

  - Use when: web-grounded search or extraction is needed, or when a repo
  script should call You.com programmatically
license: MIT
compatibility: Bun/TypeScript scripts, curl/fetch fallback, any HTTP-capable language
allowed-tools: Read Write Edit Bash(bun:*) Bash(curl:*)
metadata:
  author: youdotcom-oss
  category: sdk-integration
  version: 5.0.0
  keywords: you.com,ydc,api,research,search,contents,livecrawl,http,client,integration,citations
---

# You.com Search, Conditional Crawl, and Narrow Research

Use You.com through the official client when possible. In this repo, prefer
`@youdotcom-oss/api` inside Bun scripts and let `varlock` inject
`YDC_API_KEY`.

Use raw `fetch` only when:
- the official client does not support the needed endpoint behavior
- or you are debugging a client-specific issue

## What We Learned

Default behavior in this repo should be:

1. start with **Search**
2. use **livecrawl** or **Contents** only when search snippets are insufficient
3. use **Research** only when the question is narrow enough to anchor well

This matters because:
- broad `research lite` prompts often return weak or no-result output
- raw `fetch` against You.com Search can show transport/decompression instability
  under longer batch runs
- the official `@youdotcom-oss/api` client is the better default scripted path
  before adding custom retry logic

## Repo Rules

- Prefer repo scripts over shell-heavy one-offs.
- Prefer `@youdotcom-oss/api` over raw `fetch` for Bun scripts.
- Use `varlock` to inject `YDC_API_KEY`.
- Use Search as the default enrichment step in modnet flows.
- Use livecrawl only when the first search still leaves module shape unclear.
- Use Contents only when you already know the URL set.
- Use Research as a constrained follow-up tool, not as the default search
  replacement.

## Authentication

In this repo:

```ts
const apiKey = process.env.YDC_API_KEY
if (!apiKey) throw new Error('YDC_API_KEY is required')
```

Typical command surface:

```bash
bunx varlock run -- bun scripts/some-script.ts
```

## Preferred Programmatic Path

Use the official client first:

```ts
import { fetchSearchResults } from '@youdotcom-oss/api'

const response = await fetchSearchResults({
  searchQuery: {
    query: 'student behavior incident tracking software',
    count: 5,
  },
  YDC_API_KEY: process.env.YDC_API_KEY,
  getUserAgent: () => 'Plaited/7.x (You.com)',
})

console.log(response.results.web)
```

### Why this is the default

- cleaner than custom raw `fetch` plumbing
- better fit for repo scripts
- easier to reuse across Search/livecrawl workflows
- more robust than the raw `fetch` path we were using during Slice 14 work

## Endpoint Summary

| Endpoint | Method | URL | Use |
|---|---|---|---|
| Search | GET | `https://api.you.com/v1/agents/search` | default discovery step |
| Research | POST | `https://api.you.com/v1/research` | narrow cited synthesis |
| Contents | POST | `https://ydc-index.io/v1/contents` | explicit URL extraction |

JSON Schemas remain in `assets/`:

- [search.input.schema.json](assets/search.input.schema.json)
- [search.output.schema.json](assets/search.output.schema.json)
- [research.input.schema.json](assets/research.input.schema.json)
- [research.output.schema.json](assets/research.output.schema.json)
- [contents.input.schema.json](assets/contents.input.schema.json)
- [contents.output.schema.json](assets/contents.output.schema.json)

## Decision Rules

Use this decision tree:

1. **Need discovery, current vocabulary, or top hits?**
   - use **Search**
2. **Need richer context from one or two results?**
   - use **Search + livecrawl**
   - or **Contents** for exact URLs
3. **Need a cited synthesized answer?**
   - use **Research** only if the question is narrow and factual enough
4. **Need broad market scanning or “what models are best?”**
   - do **Search first**
   - then use narrower follow-up search or targeted research

## Search Patterns That Worked

Prefer:
- function-first queries
- workflow-first queries
- modern terminology over historical platform names
- targeted follow-up queries after the first search recovers better vocabulary

Examples:
- `student behavior incident tracking software`
- `reference metadata cleanup validation export workflow`
- `font library browser preview catalog`

Better flow:

1. broad discovery search
2. tighter follow-up search using recovered current terminology
3. optional livecrawl on the strongest result

## Research Usage Rules

Use `research lite` only when:
- the question is narrow
- a normal search already established the target topic
- you want a short cited synthesis

Avoid `research lite` first for:
- broad model ranking
- open-ended exploration
- many-model comparison prompts

Use `deep` only when:
- the question is high-value
- search already narrowed the topic
- and a deeper cited synthesis is still necessary

## Raw Fetch Fallback

Use raw `fetch` only when the client is not suitable:

```ts
const query = new URLSearchParams({
  query: 'student behavior incident tracking workflow',
  count: '3',
  livecrawl: 'web',
  livecrawl_formats: 'markdown',
})

const response = await fetch(`https://api.you.com/v1/agents/search?${query}`, {
  headers: { 'X-API-Key': process.env.YDC_API_KEY! },
})
```

If this raw path shows transport or decompression instability in a batch script:
- switch back to the official client
- do not immediately pile on more custom retry logic

## Contents vs livecrawl

Prefer **Search + livecrawl** when:
- you still need ranking/discovery
- one or two top results likely contain enough context

Prefer **Contents** when:
- you already know the exact URL set
- you want extraction without another search step

Do not use both by default.

## Contents Reliability Notes (Observed April 2026)

When using `contents` on very large single pages (for example full arXiv HTML
papers), the returned payload can be truncated and end before valid JSON close.
Treat large single-page extraction as potentially partial unless validated.

Use this operational pattern:

1. fetch known canonical URL with `contents` (for example `.../html/...`)
2. immediately validate JSON parseability (`jq`, script parse, or schema parse)
3. if parse fails or payload is partial, rerun `contents` on a compact variant
   (for arXiv, prefer `https://arxiv.org/abs/<id>`) to recover clean metadata
4. synthesize using both captures: full-page content for depth, compact page for
   citation fields and stable provenance

This keeps extraction robust without switching away from the official
`@youdotcom-oss/api` path.
