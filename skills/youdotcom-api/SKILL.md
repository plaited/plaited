---
name: youdotcom
description: >
  Use You.com Search, conditional livecrawl/contents, and narrow Research API
  follow-ups through direct HTTP calls.

  - MANDATORY TRIGGERS: You.com, youdotcom, YDC, YDC API, You.com API,
  livecrawl, contents, research lite, research deep, cited web research,
  direct API integration, no SDK

  - Use when: web-grounded search or extraction is needed, or when a repo
  script should call You.com directly with Bun `fetch`
license: MIT
compatibility: Any language with HTTP client support (curl, fetch, requests, httpx, etc.)
allowed-tools: Read Write Edit Bash(bun:*) Bash(curl:*)
assets:
  - search.input.schema.json
  - search.output.schema.json
  - research.input.schema.json
  - research.output.schema.json
  - contents.input.schema.json
  - contents.output.schema.json
metadata:
  author: youdotcom-oss
  category: sdk-integration
  version: 4.0.0
  keywords: you.com,ydc,api,research,search,contents,livecrawl,http,rest,integration,no-sdk,citations
---

# You.com Search, Conditional Crawl, and Narrow Research

Use You.com through direct HTTP calls. In this repo, prefer Bun `fetch` inside
scripts and let `varlock` inject `YDC_API_KEY`.

## What We Learned

The generic “Research first” pattern is wrong for most real tasks here.

Default behavior should be:

1. start with **Search**
2. use **livecrawl** or **Contents** only when search snippets are insufficient
3. use **Research** only when the question is narrow enough to trigger an
   actual researched answer

This matters because broad `research lite` prompts often return weak or
no-result output for:

- open-ended model discovery
- “what is best” market scans
- many-model comparisons
- broad exploratory prompts with no concrete anchor

## Repo-Specific Rules

- Prefer repo scripts and Bun `fetch` over one-off shell pipelines.
- When secrets come from `varlock`, access them directly via `process.env`.
- Avoid nested shell quoting for authenticated requests.
- Use Search as the default enrichment step in modnet flows.
- Use livecrawl or Contents only when snippets are insufficient.
- Use Research as a constrained follow-up tool, not the default search
  replacement.

## Authentication

In this repo:

```ts
const apiKey = process.env.YDC_API_KEY
if (!apiKey) throw new Error('YDC_API_KEY is required')
```

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
   - or **Contents** for explicit URLs
3. **Need a cited synthesized answer?**
   - use **Research** only if the question is narrow and factual enough to
     anchor well
4. **Need broad market scanning or “what models are best?”**
   - do **Search first**
   - then follow up with narrower `research lite` prompts if needed

## Search Patterns That Worked

Prefer:

- function-first queries
- workflow-first queries
- targeted follow-up queries after the first search recovers better terminology

Examples:

- `school discipline referral tracking software`
- `student behavior incident tracking workflow`
- `what models are currently outperforming or strongly challenging Claude Sonnet 4.5 and Claude Haiku 4.5?`

Better two-step flow:

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
- and you still need a deeper synthesized answer

## Direct Bun Examples

### Search first

```ts
const query = new URLSearchParams({
  query: 'student behavior incident tracking software',
  count: '5',
})

const response = await fetch(`https://api.you.com/v1/agents/search?${query}`, {
  headers: { 'X-API-Key': process.env.YDC_API_KEY! },
})

if (!response.ok) {
  throw new Error(`Search failed: ${response.status} ${response.statusText}`)
}

const data = await response.json()
```

### Conditional livecrawl

```ts
const query = new URLSearchParams({
  query: 'student behavior incident tracking workflow',
  count: '3',
  livecrawl: 'web',
  livecrawl_formats: 'markdown',
})
```

### Narrow research follow-up

```ts
const response = await fetch('https://api.you.com/v1/research', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.YDC_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    input: 'How does MiniMax M2.7 compare to Claude Haiku 4.5 for structured output and judge-style tasks?',
    research_effort: 'lite',
  }),
})
```

## Contents vs livecrawl

Prefer **Search + livecrawl** when:

- you still need ranking/discovery
- one or two top results likely contain enough context

Prefer **Contents** when:

- you already know the exact URL set
- you want extraction without another search step

Do not use both by default.
