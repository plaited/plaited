![Plaited sovereign agent node framework: generative UI, self-evolving agents, ATProto distribution and discovery, and memory, provenance, and verifiable work](assets/banner.svg)

# plaited

The Plaited framework — behavioral-programming runtime, SSR Renderer, browser
Controller, HTML/CSS schemas, validation utils, and CLI.

## Repository Map

- `src/` — the framework (runtime, schemas, Renderer/Controller, CLI)
- `skills/` — published reference skills (`plaited-framework`, `design`, `git-context`, `markdown`, `mcp-client`, `typescript-lsp`)
- `.agents/skills/` — workspace-installed skills
- `research/` — research briefs (`atproto-content-sites`, `mcp-apps`, Spatiotemporal Composability paper)
- `prompts/` — implementation prompts
- `scripts/` — repo setup and package-maintenance shell glue
- `bin/` — CLI entry point
- `assets/` — brand assets


## Public API

Imported as `plaited`. Three entry points:

```ts
// Main entry — behavioral runtime, Renderer, validation utils, frontier analysis
import { Renderer, validateAndEscapeHtml, validateAttributeValue, ValidationError } from 'plaited'

// Controller — browser-side controller bootstrap
import { Controller } from 'plaited/controller'

// Utils — keyMirror, deepEqual, isTypeOf, trueTypeOf, ueid, case conversion, escape, wait
import { keyMirror, deepEqual } from 'plaited/utils'
```

## What's here

- `src/main/` — behavioral runtime, Renderer (SSR), message schemas, HTML/CSS
  schemas, `html-rewriter.utils.ts` (validation utils), `swap-boundary.ts`
  (scale-check classifier), frontier analysis
- `src/controller/` — browser Controller (WebSocket-driven, applies
  `render`/`attrs`/`dispatch_custom_event`/`navigate`/`scale_check` to the live DOM)
- `src/cli/` — `plaited` CLI (`git-context`, `markdown`, `mcp-client`,
  `typescript-lsp`)
- `src/utils/` — shared utilities
- `bin/plaited.ts` — CLI entry point

## scaleCheck (advisory p-scale guidance)

`p-scale` is advisory structural metadata, not a runtime-enforced invariant.
The framework exposes a read-only `scaleCheck` pre-flight (Renderer method +
Controller `scale_check` WS message) that returns the effective structural
boundary a `render` target lives in, so a server-side b-thread can generate
content that respects the boundary before rendering. See the
`plaited-framework` skill's `design-spec.md` → Structural scale for the rule.

## Validation utilities (for b-threads and pi plugins)

The server-side b-program is the validation edge — the Controller trusts what
the server sent. Two substrate-neutral utilities are exported for pre-flighting
dynamic HTML before it crosses the WebSocket to the browser:

- `validateAndEscapeHtml(html)` — HTMLRewriter pass validating HTML attributes
  + CSS, returning the escaped HTML string
- `validateAttributeValue({ tag, attr, val })` — `on*` blocklist + per-tag
  schema `safeParse`, throws `ValidationError` on failure

## Development

```bash
bun --bun tsc --noEmit   # typecheck
bun test                 # tests
```
