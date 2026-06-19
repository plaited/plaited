# GenUI Orchestration: Symbolic Layer for Generative UI Agents

## Motivation

Generative UI (genUI) — interfaces dynamically generated in real time by AI — promises highly personalized experiences. But genUI introduces a fundamental cognitive problem: constantly changing UIs destroy the user's mental model. Every refresh becomes a relearning exercise (Nielsen Norman Group, 2024).

This document describes an architecture where a **symbolic orchestration layer** (behavioral program + SQLite event log) sits between any agent backend and a browser-side rendering engine (Plaited Controller). The layer encodes rendering constraints, user guardrails, and page history as injectable ICL context — ensuring the model generates coherent output whether it's a large remote model or a small local one.

The architecture is backend-agnostic. Hermes Agent, Cloudflare Agents, and Vercel Eve all connect to the same symbolic layer through adapter packages. The behavioral program is the artifact we optimize, not model weights.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Bun Server                                                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Symbolic Orchestration Layer                          │       │
│  │                                                       │       │
│  │  ┌──────────────────┐   ┌────────────────────────┐   │       │
│  │  │  Behavioral       │   │  db.ts (SQLite)        │   │       │
│  │  │  Engine           │   │                        │   │       │
│  │  │                   │   │  topics                 │   │       │
│  │  │  addHandler()     │   │  topic_event_log        │   │       │
│  │  │  addThread()      │   │  event_selections       │   │       │
│  │  │  trigger()        │   │  event_frontiers        │   │       │
│  │  │  useSnapshot()    │   │  event_pending_bids     │   │       │
│  │  │                   │   │  ui_events              │   │       │
│  │  └──────────────────┘   │  packages / templates    │   │       │
│  │                          └────────────────────────┘   │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Adapter:    │  │  Adapter:    │  │  Adapter:    │          │
│  │  Hermes      │  │  Cloudflare  │  │  Vercel Eve  │          │
│  │  (TUI gw)   │  │  (CF API)    │  │  (Eve API)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                     │
│                    ┌──────┴──────┐                              │
│                    │  Controller  │  ← Browser-side Plaited     │
│                    │  (page.ts)   │    runtime                   │
│                    └─────────────┘                              │
│                           │                                     │
│                    ┌──────┴──────┐                              │
│                    │  PostMessage  │  ← Web-A2A bridge          │
│                    │  (agent/g    │                              │
│                    │   etCard,    │                              │
│                    │   task/send, │                              │
│                    │   task/upd   │                              │
│                    │   ate)       │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Symbolic Orchestration Layer

The layer is two things:

1. **Behavioral engine** (`src/behavioral.ts`) — validates events against schema, routes them through threads, enforces constraints, records every decision as a snapshot. It is the constraint layer NN/g's outcome-oriented design calls for: the behavioral spec defines *what the model is allowed to do* rather than *what the UI should look like*.

2. **db.ts** (`src/agent/db.ts`) — SQLite-backed event log with tables for topics, event selections, frontiers, pending bids, and rendered UI events. It is the persistence layer for the genUI session state, user guardrails, and page history. The schema itself is a tunable artifact.

Together they form the hill climb: the behavioral program's event schema, constraint rules, and thread routing are optimized over time to produce correct ICL that makes any model (Gemma 4 26B or Claude) generate correct genUI output.

| Layer | Role | Works with |
|-------|------|------------|
| Behavioral spec (ICL) | Valid event types, constraint rules, schema | Any provider |
| Plugin-injected context | Current page state, guardrails, history | Any provider (via adapter) |
| genUI template catalog (ICL) | Example HTML output the model should produce | Any provider |
| Skills | Procedural knowledge for rendering approach | Per-agent skill system |

## Adapter Packages

Each adapter package sits in `src/adapters/<name>/` and translates the external agent's event format into behavioral events. This keeps the symbolic layer agent-agnostic.

```
framework/
  src/
    adapters/
      hermes/       → TUI gateway JSON-RPC client
      cloudflare/   → Cloudflare Agents API adapter
      eve/          → Vercel Eve adapter
    controller/     → browser-side Controller (exists)
    behavioral/     → behavioral engine (exists)
    agent/
      db.ts         → event log + query interface (exists)
```

### Hermes Adapter

Connects to a running Hermes instance via the TUI gateway WebSocket. It:

1. Opens a WebSocket to `ws://localhost:<port>` using the TUI gateway protocol
2. Receives streaming events (`message.delta`, `tool.start`, `tool.complete`, `approval.request`, etc.)
3. Translates tool results into behavioral events that the symbolic layer processes
4. Forwards behavioral events back as TUI gateway `prompt.submit` calls

This is **Pattern 2** for page routing: the adapter receives `tool.complete` events from the event stream, extracts page metadata (route, HTML, pageId), and registers the route in the Bun server. No shared filesystem, no HTTP callbacks — the page route is derived from the agent's own output.

```
Hermes Agent
   │
   │  TUI gateway WebSocket
   │  (message.delta, tool.start, tool.complete, ...)
   ▼
Hermes Adapter (src/adapters/hermes/)
   │
   │  Translates events → behavioral events
   ▼
Symbolic Layer (behavioral engine + db.ts)
   │
   │  Validates, records snapshot, publishes render
   ▼
Controller (browser) ← postMessage → Flutter / Native App
```

### Cloudflare Agents Adapter

Connects to a Cloudflare Agent running the Agents API. The `agents-api` protocol (OpenAI-compatible) provides a similar event stream. The adapter translates incoming events into behavioral events and sends prompts back through the API.

### Vercel Eve Adapter

Connects to a Vercel Eve agent. Same translation pattern — Eve's API events become behavioral events, and the symbolic layer's output becomes prompts back to Eve.

## Hermes Plugin: Context Engine + Tools + Web-A2A

The Hermes plugin is three things in one:

### 1. Context Engine Plugin

Registers via `ctx.register_context_engine()` and runs before every LLM call. It injects:

- **Always**: behavioral spec (valid event types), genUI template catalog (example HTML), active page manifest
- **Adaptively**: full page catalog + guardrail history for weak models (`if model_name in WEAK_MODELS`), compressed catalog for strong models
- **Research enforcement**: for weak models, the context engine injects a system-prompt instruction that forces a web search or content-extraction call before generating UI output

```python
class GenUIContextEngine:
    def build_context(self, model_name: str) -> str:
        always = [
            self.behavioral_spec(),
            self.template_catalog()
        ]
        if self._classify(model_name) == "weak":
            return self._inject_research_instruction(always)
        return self._compress(always)
```

### 2. Tool Plugin

Registers tools via `ctx.register_tool()`:

- `generate_ui` — generates HTML from a behavioral event + guardrails + pageId. Returns `{ pageId, html, route, stylesheets }`. The tool result streams back through the TUI gateway as a `tool.complete` event.
- `create_page` — registers a new page route with the Bun server. Accepts `{ pageId, route, title, initialHtml }`. Returns `{ url }`.
- `update_guardrails` — updates the user guardrails for the current topic. Accepts `{ must_show, should_show, never_show }`.
- `query_pages` — lists all active pages for the current session.

### 3. Web-A2A Bridge

The plugin exposes the running Hermes session as a web-a2a agent:

1. Registers an `agent/getCard` handler that returns the current AgentCard
2. A Flutter/WebView app connects to the Bun server
3. The app sends `task/send` via postMessage to the Controller
4. The Controller forwards it to Hermes via the TUI gateway WebSocket
5. Hermes processes the task; results stream back as `task/update` postMessage

This gives the user on-the-go access to the Hermes agent through a mobile WebView.

## Page Routing (Pattern 2)

Pages are ephemeral by default — generated HTML is streamed live to the Controller via `render` messages. When the agent calls `create_page`, the tool result returns `{ pageId, route, html }`. The adapter (in the Bun server) receives the `tool.complete` event from the TUI gateway, extracts the metadata, and registers a route.

```
Agent calls create_page tool
   │
   ├── Tool returns { pageId, route, html, stylesheets }
   │
   ├── TUI gateway streams tool.complete event
   │
   ├── Adapter receives event, extracts page data
   │
   └── Bun server registers route at /pages/<pageId>
         Controller navigates or user bookmarks

On revisit:
   GET /pages/<pageId>
        │
        ├── Bun server serves the Controller with page HTML
        │
        └── Controller reconnects to agent via WebSocket
              Agent regenerates content via topic memory
```

Page persistence is handled by the topic system in db.ts — each page is a topic with bounded `memory` and `user` fields. On reconnect, the agent reads the topic context and regenerates the page within the guardrails.

## Mental Model: Topics as genUI Sessions

Each genUI page or user session maps to a topic in db.ts:

| Concept | Storage | Purpose |
|---------|---------|---------|
| Page context | `topics.memory` (≤2200 chars) | What was generated, why, last interaction |
| User guardrails | `topics.user` (≤1375 chars) | must_show, should_show, never_show |
| Page manifest | `query_events` filter by kind | List of all pages for the session |
| Render history | `ui_events` table | Every render/attrs sent to Controller |
| Agent decisions | `event_selections` | What the model chose to do |
| Exploration space | `event_frontiers` | What the model considered |

The topic bounds are enforced by the behavioral engine, not schema constraints. When a topic's `memory` exceeds 2200 characters, the behavioral program triggers a `memory_overflow` event and a condensation strategy thread compresses it. This is the NN/g insight encoded in the architecture: bounded memory prevents context drift while preserving the user's mental model.

## Adaptive ICL Injection

The context engine plugin adapts per model:

| Model tier | Example | Context injected | Forced groundings |
|------------|---------|------------------|-------------------|
| Strong | Claude Sonnet 4, GPT-4o | Compressed behavioral spec, template catalog | None |
| Medium | Claude Haiku, GPT-4o-mini | Full behavioral spec, compressed page catalog | Optional research |
| Weak | Gemma 4 26B, Llama 3.2 | Full behavioral spec, full page catalog, full guardrails | Research before every generation |

For weak models, the context engine injects:

```
BEFORE generating any UI output, you MUST call generate_ui_context
to retrieve the current behavioral spec and active page catalog.
Do not assume you know the rendering system's constraints —
ground every generation in the retrieved context.
```

## Hill Climb Path

The behavioral program + SQLite schema is the tunable artifact. The optimization loop:

```
1. Define behavioral spec (event types, constraints, thread routing)
2. Agent generates genUI output within the spec
3. recordSnapshot() captures the selection + frontier + result
4. Query db.ts for failures (feedback_errors, deadlocks, runtime_errors)
5. Adjust behavioral spec: tighten constraints, add new event types,
   modify thread routing, change guardrail bounds
6. Repeat
```

Training data for Code2LoRA (when desired) comes from successful `event_selections` — the model generated correct genUI output within the spec. Extract pairs from the event log, train a LoRA, load it alongside a local model. But the spec itself improves the model's output without training, so Code2LoRA is an optimization, not a prerequisite.

## Relationship to Existing Architecture

| Existing artifact | Preserved? | Fate |
|------------------|------------|------|
| `src/agent/db.ts` | Yes | Core of the symbolic layer. Schema adjusted for genUI context. |
| `src/behavioral.ts` | Yes | Behavioral engine is unchanged. |
| `src/ui/controller.ts` | Yes | Controller renders genUI output. |
| `src/ui/template.ts` | Yes | Template system generates pages. |
| `src/agent/agent.ts` | No | Replaced by adapter packages. The WebSocket server + worker logic moves to adapters. |
| `src/agent/worker.ts` | No | Worker interface moves to adapter packages. |
| `docs/web-a2a.md` | Yes | Web-A2A bridge uses this protocol. |
| Topics/workflows | No | Dropped. Pages are lightweight topics in db.ts, not git bare repos. |
