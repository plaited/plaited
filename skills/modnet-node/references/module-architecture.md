# Module Architecture

Implementation details for the module-per-repo workspace structure. Design rationale is in `docs/MODNET-IMPLEMENTATION.md`.

## Node Structure

```
node/                               ← git repo (.gitignore excludes modules/)
  .git/
  .gitignore                        ← modules/
  .memory/                          ← node-level decisions (session coordination, cross-module)
    @context.jsonld
    sessions/
    constitution/
  package.json                      ← "workspaces": ["modules/*"], "private": true
  bun.lock                          ← human-readable lockfile
  tsconfig.json
  modules/
    apple-block/                    ← git repo (independent of node .git)
      .git/
      .memory/                      ← module-scoped decisions (tool results, code changes)
        sessions/
      package.json                  ← name: "@node/apple-block", "modnet": { MSS tags }
      skills/
        apple-block/                ← seed skill (named after module)
          SKILL.md                  ← seed body + CONTRACT in metadata
          scripts/                  ← committed generated code
          references/               ← interface.jsonld, decisions.md
          assets/                   ← grading.jsonl (eval criteria)
      data/
        varieties.json
    farm-stand/                     ← git repo (independent of node .git)
      .git/
      .memory/                      ← module-scoped decisions
        sessions/
      package.json                  ← depends on "@node/apple-block": "workspace:*"
      skills/
        farm-stand/                 ← seed skill
          SKILL.md                  ← seed body + CONTRACT in metadata
          scripts/                  ← committed generated code
          references/               ← interface.jsonld
          assets/                   ← grading.jsonl
        price-lookup/               ← additional capability skill
          SKILL.md
          scripts/
      data/
        inventory.json
```

The node directory is a git repo (`.gitignore` excludes `modules/`). Each module in `modules/` has its own `git init`. This gives two layers of version history: node-level (constitution, global config, node `.memory/`) and module-level (code, data, module `.memory/`). OS-level backups capture `.git` folders. Bun workspace resolution (`workspace:*`) works regardless of whether subdirectories have `.git/`.

Modules follow the AgentSkills specification. Each module has a `skills/` directory containing a seed skill (named after the module) and optional capability skills. MSS bridge-code tags and CONTRACT fields live in the `metadata` field of SKILL.md frontmatter (arbitrary string key-value pairs, spec-compliant). The PM reads SKILL.md metadata for module discovery, cross-module queries, and dependency resolution — no sidecar database needed.

## Package.json as Module Manifest

MSS bridge-code tags live in a custom `"modnet"` field in `package.json`:

```json
{
  "name": "@node/farm-stand",
  "version": "1.0.0",
  "dependencies": {
    "@node/apple-block": "workspace:*"
  },
  "modnet": {
    "contentType": "produce",
    "structure": "list",
    "mechanics": ["sort", "filter"],
    "boundary": "ask",
    "scale": 3
  }
}
```

The `@node` scope is the agent's identity scope. All module packages share this scope. The `workspace:*` protocol resolves inter-module imports via Bun's workspace resolution — standard TypeScript imports, no custom loader.

## Scale Mapping

Scale determines module complexity:

| Scale | Structure | Example |
|---|---|---|
| S1 | JSON data + template | Single `data.json` + one JSX template |
| S2 | Structured data + list rendering | Multiple data files + list component |
| S3 | Multiple files + behavioral code + streams | Full package with `src/`, `data/`, behavioral modules |
| S4+ | Full package with dependencies | Package depending on other workspace packages |

## Code vs. Data Boundary

Each module package separates code from data:

- **`src/`** (or root `.ts` files) — code, bThreads, templates, behavioral modules. Never leaves the node.
- **`data/`** — JSON, assets, structured content. Can cross A2A boundaries, gated by the module's `boundary` tag.

A constitution MAC bThread blocks code from crossing A2A boundaries. When another node requests data from a module with `boundary: "all"` or `boundary: "ask"`, only the `data/` contents are eligible for sharing. The module's code stays internal — the receiving agent generates its own code to process the data.

## Browser Compilation

Bun runs TypeScript natively — no compilation needed for server-side module code. The only compilation step is `Bun.build({ target: 'browser' })` for behavioral modules sent to the client via `update_behavioral`. These are `.behavior.ts` files that the agent compiles on-demand when rendering generative UI.

## Dependency Isolation

Bun workspace resolution handles inter-module imports via symlinks. Each module declares its dependencies in `package.json` and can only import what it declares — standard npm semantics. The single `bun.lock` at the node root tracks the full dependency tree.

## Module Registry (SKILL.md Metadata)

> **Supersedes:** The `.meta.db` per-module sidecar and `.workspace.db` workspace view documented in earlier revisions. In the C+D module architecture, the PM generates code from specifications it already has — source-file scanning for branded objects is unnecessary.

The PM reads SKILL.md `metadata` fields for module discovery, cross-module queries, and dependency resolution. MSS bridge-code tags (`contentType`, `structure`, `mechanics`, `boundary`, `scale`) and CONTRACT fields (`produces`, `consumes`) are stored as string key-value pairs in the AgentSkills `metadata` field:

```yaml
---
name: farm-stand
description: Produce inventory management with filtering and sorting
metadata:
  contentType: produce
  structure: list
  mechanics: sort,filter
  boundary: ask
  scale: "3"
  produces: inventory-data
  consumes: apple-data
---
```

**Cross-module queries** use the same metadata: the PM scans `skills/*/SKILL.md` frontmatter to find modules by `contentType`, `scale`, or `produces`/`consumes` relationships. No SQLite, no collector tool, no workspace rebuild.

**Validation:** Modules validate with `bunx @plaited/development-skills validate-skill` — the same tool that validates framework skills.

## Asset Management: Symlinks Over Git LFS

Large assets (images, models, datasets) live outside the workspace and are symlinked in. This avoids git repository bloat without the complexity of git LFS:

```
~/assets/                           ← outside workspace, not in git
  farm-photos/
    apple-red.jpg
    apple-green.jpg

workspace/modules/farm-stand/data/
  photos -> ~/assets/farm-photos    ← symlink
```

A constitution bThread enforces symlink integrity:

```typescript
// Asset symlink guard — blocks execute if symlink targets are missing or outside allowed paths
bSync({
  block: ({ type, detail }) => {
    if (type !== 'execute') return false
    return isSymlinkViolation(detail)
  }
})
```

The bThread ensures the agent cannot create symlinks to arbitrary filesystem locations (a security concern in a sandboxed environment). Only symlinks from `data/` directories to the configured asset root are permitted.

## Future: Local Registry Migration

When a workspace grows beyond practical limits for Bun workspaces (hundreds of packages, deeply nested dependency graphs), the migration path is a local npm registry:

1. Deploy a local registry (e.g., Verdaccio) on the node
2. Add a `bunfig.toml` at the node root to point `@node` scope at the local registry
3. Publish packages via `bun publish` instead of `workspace:*` resolution
4. No code changes — imports stay the same, only resolution changes

```toml
[install.scopes]
"@node" = { url = "http://localhost:4873" }
```

## Modules vs. Projects

Modules and projects are distinct concepts with different isolation models:

| Concern | Module | Project |
|---|---|---|
| **What** | Internal package within the node's workspace | External codebase (user's repo) |
| **Git** | Own git repo within `modules/` | Separate git repo, external |
| **Isolation** | Bun workspace dependency isolation | Process isolation (Bun.spawn + IPC) |
| **Scope** | `@node/` scope, workspace:* resolution | Independent, orchestrator-routed |
| **Lifecycle** | Created/modified by agent as workspace packages | Registered on encounter, independent subprocess |

The orchestrator (see `PROJECT-ISOLATION.md`) manages projects as separate subprocesses. Modules are packages within the node's own workspace — they don't need process isolation because they're the agent's own code.
