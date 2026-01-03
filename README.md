# Plaited

A behavioral programming framework for reactive systems and AI-assisted development.

[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/ci.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/ci.yml)
![Bundle Size](https://img.shields.io/badge/gzip-<7.5kb-brightgreen)



## Features

- **Behavioral programming** - Coordinate complex interactions with simple, declarative threads using `useBehavioral`
- **Reactive custom elements** - Build UIs with `bElement` combining behavioral programs and Shadow DOM
- **Template-based architecture** - Composable templates with CSS-in-JS styling
- **Beyond UI** - Use behavioral programming for neuro-symbolic agents and reactive systems
- **AI-assisted development** - Optional plugin provides intelligent code assistance

## Quick Start

Get up and running in 4 steps:

### Step 1: Install the package

```bash
# Full install (recommended if using the AI plugin)
bun install plaited

# Minimal install (main + utils only, no dev dependencies)
bun install plaited --omit peer
```

### Step 2: Install the Cluade plugin (recommended)

In Claude Code:
```
/plugin marketplace add plaited/plaited
```

### Step 3: Create your first story

Create `src/button.stories.tsx`:

```tsx
import { type FT, createStyles } from 'plaited/ui'
import { story } from 'plaited/testing'

const styles = createStyles({
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0066cc',
    color: 'white',
    cursor: 'pointer',
  }
})

const Button: FT = ({ children }) => (
  <button class={styles.button}>{children}</button>
)

export const primary = story({
  render: () => <Button>Click me</Button>
})
```

### Step 4: Start the dev server

```bash
bun plaited dev
```

Open the URL shown in your terminal to see your button. That's it!

---

<details>
<summary><strong>Package Exports</strong></summary>

| Export | Description |
|--------|-------------|
| `plaited` | Core framework - behavioral programming, signals, workers |
| `plaited/ui` | UI framework - templates, custom elements (bElement), styling |
| `plaited/utils` | Utility functions - type guards, helpers |
| `plaited/testing` | Test utilities - story factory, test helpers |
| `plaited/workshop` | Discovery utilities - template and story collection (requires Bun) |

**CLI** (requires Bun):
- `bun plaited dev` - Start dev server with story browser
- `bun plaited test` - Run story-based tests with Playwright

```typescript
import { useBehavioral, useSignal } from 'plaited'
import { bElement, createStyles } from 'plaited/ui'
import { wait, noop } from 'plaited/utils'
import { story } from 'plaited/testing'
```

</details>

<details>
<summary><strong>AI Plugin Features</strong></summary>

The Plaited AI plugin supercharges your development with intelligent assistance:

**Skills** (auto-activated based on context):
- **plaited-standards** - Code conventions, development standards, verification workflow
- **plaited-behavioral-core** - Behavioral programming patterns, neuro-symbolic reasoning
- **plaited-ui-patterns** - Templates, bElements, styling, forms, stories
- **typescript-lsp** - Type verification, symbol discovery, code navigation
- **code-documentation** - TSDoc templates and workflow
- **workbench** - Story discovery, dev server, visual feedback via Playwright
- **plaited-web-patterns** - Web API patterns adapted for Plaited
- **design-system** - Design token patterns and scaffolding scripts

**Agents** (specialized reviewers):
- **architecture-reviewer** - Validates behavioral programming patterns
- **documentation-cleanup** - Enforces documentation standards

**Commands**:
- `/create-web-patterns-skill` - Extract Web API patterns from online articles
- `/create-design-system-skill` - Create a new design system extraction skill
- `/validate-skill` - Validate skill directories against AgentSkills spec

</details>

<details>
<summary><strong>For Non-Claude Users</strong></summary>

If you're using a different AI assistant (Cursor, Copilot, etc.), you can still use the Plaited plugin:

```bash
curl -fsSL https://raw.githubusercontent.com/plaited/plaited/main/scripts/install-plugin.sh | bash
```

This installs the plugin to `.plaited/` and creates an `AGENTS.md` file with instructions for your AI assistant.

</details>

<details>
<summary><strong>Requirements</strong></summary>

**For full development (CLI, workshop, testing):**
- [Bun](https://bun.sh/) >= v1.2.9

**For main package only:**
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
