# Tool Assembly

## Three-Layer Model

Tools are assembled from three layers when a project subprocess spawns:

| Layer | Location | Scope | Discovery |
|---|---|---|---|
| **Framework built-ins** | Shipped with `plaited/agent` | All projects | Always available |
| **Global user config** | `~/.agents/skills/`, `~/.agents/mcp.json` | All projects | Loaded at subprocess spawn |
| **Project skills** | `skills/*` | This repo, all agents | Discovered from repo |

### Framework Built-ins

Core tools shipped with the agent framework: `read_file`, `write_file`, `bash`, `save_plan`, etc. Always available, no approval needed.

### Global User Config

User-installed skills and MCP servers that apply across all projects:
- `~/.agents/skills/*` — skill directories following AgentSkills format
- `~/.agents/mcp.json` — MCP server configurations

These are loaded at subprocess spawn. The user explicitly installs them, so they carry user-level trust.

### Project Skills

Skills discovered from the project's `skills/` directory. Portable, publishable, versioned with the repo. Project skills are scoped to the repository — they don't leak across project boundaries.

## Spawn-Time Assembly

At subprocess spawn, tools are assembled in order:

```
Framework built-ins (read_file, write_file, bash, save_plan, etc.)
  + ~/.agents/skills/*          → global skills
  + ~/.agents/mcp.json servers  → global MCP tools
  + skills/*                    → project skills
  + OS PATH binaries            → discovered, approval-gated
  + project-local binaries      → node_modules/.bin/, etc.
  → model sees available tools in context
```

The model receives the union of all discovered tools in its context. Tool names must be unique across layers — project skills can shadow global skills of the same name (project-specific overrides).

## Approval Model

Mapped to the authority axis of the risk model:

| Tool source | Authority level | Approval |
|---|---|---|
| Framework built-ins | N/A | Always available |
| Global skills / MCP | User-configured | User installs explicitly |
| Project skills / MCP | Project-scoped | Discovered from repo |
| Project-local CLIs | Low (scoped to repo) | Auto-install if user opts in |
| OS PATH / global CLIs | High (affects all projects) | Always requires user approval |
| Global CLI upgrades | High | Requires approval + dependency scanning |

### Global CLI Approval Gate

Global CLI approval is enforced by a looping bThread that blocks `install_global_tool` and `upgrade_global_tool` events until a `user_confirm` event arrives:

```typescript
bThreads.set({
  globalCliGate: bThread([
    bSync({
      waitFor: (e) => e.type === 'install_global_tool' || e.type === 'upgrade_global_tool',
      block: (e) => e.type === 'execute_install',
    }),
    bSync({ waitFor: 'user_confirm' }),
    // After confirm, the blocked execute_install can proceed
  ], true),
})
```

This uses the phase-transition gate pattern from **behavioral-core** — the thread alternates between blocking execution and waiting for user confirmation.
