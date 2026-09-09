# @behavioral/sh

A behavioral agent harness — a neuro-symbolic, self-improving agent built on the
behavioral-programming runtime. The agent ships with an irreducible coordination floor
(the behavioral engine + the turn loop) and grows by composing plugins: everything above the
kernel is a plugin (`plugin.json`), and the agent improves as behaviors, tools, and skills are
added to or removed from a space. Neural generation proposes; symbolic verification disposes; the
exhaust is the teacher.

## Repository Map

- `src/kernel/` — the coordination floor: `behavioral()`, threads, dispatch bridge, OAuth
- `src/tools/` — agent tools as stateless `useTool` units (AJV `JSONSchemaType` schemas);
  `plugin-loader.ts` parses `plugin.json`
- `src/behavioral/` — the behavioral runtime (types, constants, utils)
- `src/controller/` — the browser Controller + delegated listener + swap boundary
- `src/cli/` — the `behavioral` CLI (`makeCliRouter`/`parseCli`); commands registered in `bin/behavioral.ts`
- `src/utils/` — shared pure utilities
- `tasks/` — Harbor skill-authoring task specs (challenge content; not shipped)
- `skills/` — published reference skills
- `.agents/skills/` — workspace-installed skills
- `bin/behavioral.ts` — CLI entry point

## Public API

Imported as `@behavioral/sh`:

```ts
// Tools — useTool, plugin-loader, the tool fleet
import { useTool } from '@behavioral/sh/tools'

// Controller — browser-side controller bootstrap
import { Controller } from '@behavioral/sh/controller'

// Utils — keyMirror, deepEqual, isTypeOf, trueTypeOf, ueid, case conversion, escape, wait
import { keyMirror, deepEqual } from '@behavioral/sh/utils'
```

## Plugin model

A plugin is a directory conforming to [Agent Plugins v1](https://agent-plugins.org/): a required
`plugin.json` manifest, an optional `skills/` of Agent Skills, an optional `mcp.json` declaring
MCP servers, and a reverse-domain `sh.behavioral/` extension namespace for behavioral-owned
declarations (threads, models, per-space gating). The kernel is the stable floor beneath it; the
policy layer above is minimal and improvable.

## Development

```bash
bun --bun tsc --noEmit   # typecheck
bun test                 # tests
```
