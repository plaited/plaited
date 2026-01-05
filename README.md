![Plaited a Neuro-Symbolic Agentic Framework: AI-Assisted Design Systems, Generative UI Agents, Personalized Knowledge Worker Screens](assets/banner.svg)

**A behavioral programming framework for generative UI**

[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/ci.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/ci.yml)
![Bundle Size](https://img.shields.io/badge/gzip-<7.5kb-brightgreen)

---

Plaited is a vertically integrated stack—from behavioral programming core to UI rendering to workshop tooling—designed so that design system developers can leverage AI without becoming ML engineers.

The framework's behavioral programming model aligns naturally with reinforcement learning, making stories serve as both tests and ground truth for what "correct UI" means. This enables continuous, human-in-the-loop improvement rather than one-shot generation.

## Get Started

### Step 1: Install the package

```bash
bun install plaited
```

### Step 2: Add the Workshop plugin

**Claude Code:**
```
/plugin marketplace add plaited/plaited
```

**Other AI coding agents:**
```bash
curl -fsSL https://raw.githubusercontent.com/plaited/plaited/main/scripts/install-workshop.sh | bash
```

The installer detects your agent or lets you choose:

```
┌─────────────┬──────────────────┬─────────────────────────────────────┐
│ Agent       │ Directory        │ Supported Features                  │
├─────────────┼──────────────────┼─────────────────────────────────────┤
│ claude      │ .claude/         │ skills, commands, agents, hooks     │
│ cursor      │ .claude/         │ skills                              │
│ opencode    │ .opencode/       │ skills, commands, agents            │
│ amp         │ .agents/         │ skills, commands                    │
│ goose       │ .claude/         │ skills                              │
│ factory     │ .factory/        │ skills                              │
└─────────────┴──────────────────┴─────────────────────────────────────┘
```

### Step 3: Start building

```bash
# Start the dev server
bun plaited dev

# Run story tests
bun plaited test
```

Describe what you want, let the AI generate templates and stories, then iterate with test feedback.

## Why Behavioral Programming?

Behavioral programming was chosen intentionally—it aligns with how reinforcement learning agents reason about the world:

- **Stories as world model** — Stories define valid UI states and transitions, serving as ground truth for both testing and agent training
- **Runtime constraints** — bThreads block invalid actions before they execute, providing symbolic guardrails for neural generation
- **Natural reward signals** — Story pass/fail + accessibility checks = clear training signal

This architecture enables the [World Agent](training/README.md)—a neuro-symbolic system where a neural policy proposes actions and behavioral constraints ensure correctness.

**Performance:** Plaited is also fast. See the [js-framework-benchmark results](https://krausest.github.io/js-framework-benchmark/2025/table_chrome_143.0.7499.41.html).

<details>
<summary><strong>Package Exports</strong></summary>

The vertical integration is reflected in the package structure:

| Export | Description |
|--------|-------------|
| `plaited` | Core behavioral programming — `useBehavioral`, `useSignal`, `useWorker` |
| `plaited/ui` | UI framework — templates, `bElement`, `createStyles` |
| `plaited/utils` | Utility functions — type guards, helpers |
| `plaited/testing` | Test utilities — `story` factory, Playwright integration |
| `plaited/workshop` | Discovery utilities — template and story collection |
| `plaited/agent` | Agent utilities — world agent, tool definitions |

```typescript
import { useBehavioral, useSignal } from 'plaited'
import { bElement, createStyles } from 'plaited/ui'
import { story } from 'plaited/testing'
```

**CLI** (requires Bun):
- `bun plaited dev` — Start dev server with story browser
- `bun plaited test` — Run story-based tests with Playwright

</details>

<details>
<summary><strong>Workshop Plugin Features</strong></summary>

The Workshop plugin provides intelligent assistance for Plaited development:

**Skills** (auto-activated based on context):
- **plaited-standards** — Code conventions, development standards, verification workflow
- **plaited-behavioral-core** — Behavioral programming patterns, neuro-symbolic reasoning
- **plaited-ui-patterns** — Templates, bElements, styling, forms, stories
- **typescript-lsp** — Type verification, symbol discovery, code navigation
- **code-documentation** — TSDoc templates and workflow
- **workbench** — Story discovery, dev server, visual feedback via Playwright
- **design-system** — Design token patterns and scaffolding scripts
- **world-agent** — Agent training, trajectory generation, evaluation, A2A integration

**Agents** (specialized reviewers):
- **architecture-reviewer** — Validates behavioral programming patterns
- **documentation-cleanup** — Enforces documentation standards

**Commands**:
- `/validate-skill` — Validate skill directories against AgentSkills spec
- `/create-web-patterns-skill` — Extract Web API patterns from articles
- `/create-design-system-skill` — Create design system extraction skill

</details>

<details>
<summary><strong>Requirements</strong></summary>

**For full development (CLI, workshop, testing):**
- [Bun](https://bun.sh/) >= v1.2.9

**For core package only:**
- Node.js >= v22.6.0 (with `--experimental-strip-types`)
- Or Bun >= v1.2.9

</details>

## Getting Help

- **Questions & Discussions**: [Plaited Discussions](https://github.com/orgs/plaited/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/plaited/plaited/issues)

## License

ISC

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
