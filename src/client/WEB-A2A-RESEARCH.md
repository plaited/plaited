# web-A2A Agent Framework: Research Synthesis

## Problem Space

Build a TypeScript framework for creating **multi-page web applications that are also agents from inception**. Two agents exist in this model:

1. **Server-side agent** (Hono) — generates HTML UIs within template constraints, scoped by the user's boundaries. Uses Plaited's behavioral runtime (`spec`, `syncPoints`, `thread`) to manage page-level state and decide what to render.
2. **Client-side agent** — the user's personal agent, running in the browser. It communicates with the server-side agent via **web-A2A** (`postMessage` → `Controller.ts` WebSocket → Hono).

Each page is simultaneously:
- A **server-rendered view** within a **topic** — topics are persistent contexts that live across sessions (e.g., a video channel, a project, a workspace)
- An **agent endpoint** — exposing A2A skills to the user's client agent
- A **module** — within a topic, different pages/views can be dynamically generated to serve different purposes

Login state determines:
- **User boundaries** — what data and UI the user sees (traditional auth)
- **Tool boundaries** — what agent functions the user can invoke
- **Remote agent boundaries** — what tasks remote agents can delegate

Screens are generated dynamically from templates within the constraints defined by the page's spec. The rendering layer (`Controller.ts`) and the agent layer share a single behavioral runtime. No arbitrary file writes — templates are provisioned safely.

---

## 1. Core Inspiration: Cloudflare Agents

Cloudflare's Agents SDK maps one agent = one Durable Object (stateful micro-server with SQL, WebSocket, scheduling). Key ideas:

| Idea | Cloudflare Agents | Our adaptation |
|---|---|---|
| **Agent = class** | `class ChatAgent extends AIChatAgent` | Agent is a Hono router + behavioral spec + A2A handler |
| **State** | Durable Object SQL (persistent, global) | Session-scoped state via Plaited's behavioral model + server-side storage |
| **RPC** | `@callable()` decorator → typed WebSocket methods | `get/agentCard` + `postMessage` (web-A2A) |
| **Client binding** | `useAgent()` React hook → WebSocket → agent | `Controller.ts` WebSocket + `p-trigger` events |
| **Tools** | Server-side, client-side, MCP | Plaited extensions + behavioral specs |
| **Scheduling** | `ctx.run()` for delayed/cron tasks | Behavioral `thread()` with time-based sync points |
| **Human-in-loop** | Framework primitive for approval flows | Extension pattern via `interrupt` idioms |

**Key difference:** Cloudflare agents are Durable Objects — a single global instance per agent id. Plaited agents are **per-page, per-session** — each page load creates a fresh agent session scoped to that user's boundaries. This is correct for an MPA model where auth state is per-request, not per-global-instance.

---

## 2. Framework Runtime: Hono

Hono is the correct runtime for three reasons:

1. **Multi-runtime** — Same code runs on Cloudflare Workers, Bun, Deno, Node. The agent framework isn't locked to one platform.
2. **Web Standards** — Uses `Request`/`Response`. Plaited's `Controller.ts` already speaks WebSocket + `postMessage`. Hono handles HTTP routing natively.
3. **TypeScript-first** — Strong type inference on routes, params, bodies. Pairs naturally with Zod (already used in Plaited's `behavioral.schemas.ts`).

### Proposed Hono integration pattern

```ts
import { Hono } from 'hono'
import { behavioral, webA2A, render } from 'plaited/agent'
import { defineTemplate } from 'plaited/ui'

const app = new Hono()

// Agent card: web-A2A extension
app.get('/.well-known/agent-card.json', (c) => {
  return c.json({
    name: 'Kanban Agent',
    description: 'A kanban board that serves pages and exposes agent skills',
    version: '1.0.0',
    protocolVersion: '1.0',
    supportedInterfaces: [
      {
        url: c.req.url,
        protocolBinding: 'HTTP+JSON',
      },
    ],
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/html', 'application/json'],
    skills: [
      {
        id: 'create_card',
        name: 'Create Card',
        description: 'Add a new card to a column',
        tags: ['kanban', 'card'],
      },
    ],
    modnet: {
      content: 'board',
      scale: 'S5',
      boundary: 'ask',
      mechanics: { drag: 'reorder', click: 'edit' },
    },
  })
})

// Behavioral spec — defines agent as a behavioral program
const boardSpec = useSpec({
  label: 'kanban-board',
  thread: {
    syncPoints: [
      {
        waitFor: [{ type: 'click:create_card' }],
        request: { type: 'card_created', detail: { title: 'string' } },
      },
    ],
  },
})

// Page route — renders agent UI
app.get('/board/:id', async (c) => {
  const session = await createSession(c.req, { spec: boardSpec, user: c.get('user') })
  return c.html(render(session))
})

// Agent A2A endpoint — remote agents can invoke skills
app.post('/a2a', async (c) => {
  const msg = await c.req.json()
  const result = await handleA2A(c, msg)
  return c.json(result)
})
```

---

## 3. Agent Model: Behavioral Programming

Plaited already has the behavioral engine (`behavioral.ts`, `use-spec.ts`, `behavioral.schemas.ts`). A `Spec` defines the agent as a set of synchronization points (`waitFor`, `interrupt`, `block`, `request`) that form a thread.

For the web-A2A agent, the behavioral model maps to:

| Behavioral concept | web-A2A mapping |
|---|---|
| **Spec** | Agent definition — describes what events the agent responds to and what it produces |
| **`waitFor`** | Listening for A2A tasks or UI events (`p-trigger` clicks) |
| **`request`** | Emitting a behavioral event (triggers server-side handler or render) |
| **`interrupt`** | Human-in-the-loop approval for agent actions |
| **`block`** | Permission boundary — blocks execution if user lacks authorization |
| **`syncPoints`** | Session lifecycle — each sync point is a state machine transition |

The agent is **not** a monolithic LLM call. It's a behavioral program that coordinates:

- UI events from the browser (via `Controller.ts` WebSocket)
- A2A task requests from remote agents (via `postMessage`)
- Server-side business logic (data access, auth checks)
- Template rendering (sending HTML fragments back to the Controller)

### Relationship to pi

Pi's SDK provides tool-calling, extensions, and model orchestration for LLM-powered agents. In the web-A2A context, pi integration would:

1. Register a subset of pi's capabilities as A2A skills (e.g., `search`, `read`, `summarize`).
2. Map behavioral `request` events to pi's `session.prompt()` for LLM-powered decisions.
3. Use pi's extension system for dynamic tool registration — allowing logged-in users to load different tool sets based on permissions.

The integration lives at `@adapters/pi/` and provides:

```ts
import { createPiSkill } from '@adapters/pi'

const searchSkill = createPiSkill({
  name: 'web_search',
  description: 'Search the web',
  tools: ['you-search'],
  auth: { scope: 'premium' }, // only users with premium tier
})
```

---

## 4. Topics: Persistent Context, Not Sessions

A topic is **not** a session. A session is transient — it ends when the browser tab closes. A topic persists across sessions. It's the thing the agent saves memory about.

**Examples:**

- A streaming video platform → a **channel** is a topic. It has child pages (video pages, scheduling, comments, playlists) each surfacing different mechanics of the same topic.
- A project management tool → a **project** is a topic. Boards, timelines, docs, and dashboards are all pages/modules within it.
- A kanban board → the **board** is the topic. Cards, columns, swimlanes are views into it.

### Topic-Enriched Events

Building on `define-behavior.ts`, every event carries the topic identifier:

```ts
trigger({ type: 'card_created', topic: 'board:project-42', detail: { title: '...' } })
```

This lets the behavioral engine correlate events across page loads, WebSocket reconnections, and even different user sessions (for collaborative topics). The spec's `syncPoints` match on `(type, topic)` pairs — not just `type`.

### Pages as Modules Within a Topic

In the Claude Code article, HTML files are used as rich, interactive artifacts for communicating complex information. In this framework, **the agent generates actual web pages as views within a topic** — not just artifacts.

```
Topic: "project-42" (kanban board project)
  ├── Page: /board          → modnet { content: "board",  scale: "S5", mechanics: { drag: "reorder" } }
  ├── Page: /timeline       → modnet { content: "timeline", scale: "S4", mechanics: { zoom: "range" } }
  ├── Page: /docs           → modnet { content: "doc", scale: "S3", mechanics: { edit: "markdown" } }
  └── Page: /reports        → modnet { content: "report", scale: "S6", mechanics: { filter: "date" } }
```

Each page is a **module** — a different view into the same topic, with its own modnet tags (content type, scale, boundary, mechanics). The agent generates these pages dynamically within the template constraints defined by the page's spec.

This is the insight from the Claude Code article applied to web apps: **HTML is a superior format for agent-generated content** because it carries design (CSS), illustrations (SVG), interactions (JS), and spatial data. When the server-side agent generates a page, it's not rendering from a fixed template — it's **composing an HTML view** within the constraints of the page's spec rules, the user's boundaries, and the topic's modnet tags.

The agent can generate different visualizations of the same topic depending on:
- What the user is trying to do (their current mission within the topic)
- Their permissions (boundary)
- The mechanics available at that page's modnet scale

```ts
// The Hono agent generates a page view dynamically
app.get('/board/:id', async (c) => {
  const topic = `board:${c.req.param('id')}`
  const user = c.get('user')
  const view = await agent.renderView({
    topic,
    page: 'board',
    user,
    spec: boardSpec,  // behavioral spec for this page
    template: user.provisionedLayout ?? defaultBoardTemplate,
  })
  return c.html(view)
})
```

### How `define-behavior.ts` Concepts Apply

The `define-behavior.ts` wrapper bakes topic into every event:

```ts
const trigger: Trigger = ({ type, detail }) => {
  baseTrigger({ type, topic, detail: { ...(detail && detail) } })
}
```

And every `sync`, `waitFor`, `interrupt`, and `block` listener is scoped to the topic:

```ts
args[idiom] = ensureArray(value).map((listener) => ({ ...listener, topic }))
```

This means:
- **Memory is per-topic.** The agent's event log, pending threads, and snapshot state are keyed by topic, not by session.
- **Permissions are per-topic.** A user might have `write` access on topic A but `read` only on topic B.
- **Collaboration is per-topic.** Multiple users can connect to the same topic, with the server agent coordinating renders based on who did what.

---

## 5. Boundaries: Auth → Tools → Agent Visibility

The key insight: **login state defines three concentric boundaries**.

```
                    ┌─────────────────────────┐
                    │   Remote Agent Boundary │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │  Tool Boundary    │  │
                    │  │                   │  │
                    │  │  ┌─────────────┐  │  │
                    │  │  │ User UI     │  │  │
                    │  │  │ Boundary    │  │  │
                    │  │  │             │  │  │
                    │  │  │ card        │  │  │
                    │  │  │ visibility  │  │  │
                    │  │  └─────────────┘  │  │
                    │  │                   │  │
                    │  │  which skills     │  │
                    │  │  are callable     │  │
                    │  │  by the user      │  │
                    │  └───────────────────┘  │
                    │                         │
                    │  which tasks remote     │
                    │  agents can submit      │
                    └─────────────────────────┘
```

**User UI Boundary** — what HTML the user sees (standard auth). The `modnet.boundary` tag changes per session (`'all'` for admin, `'ask'` for logged-in user, `'none'` for anonymous).

**Tool Boundary** — what agent functions/pi extensions the user can invoke. Not all users get `bash` or `write`. Behavioral `block` sync points enforce this.

**Remote Agent Boundary** — what tasks external A2A agents can submit. A remote agent might be able to create a card but not delete a board. The A2A skills listed in the AgentCard are filtered per session.

Implementation: the Hono middleware extracts the user from the session/token and injects it into context. The behavioral spec reads `c.get('user')` to determine which sync points are enabled/blocked.

```ts
app.use('*', async (c, next) => {
  const user = await authenticate(c.req)
  c.set('user', user) // null for anonymous
  c.set('boundaries', computeBoundaries(user))
  await next()
})
```

---

## 6. Template Provisioning: Safe Dynamic HTML

The controller renders HTML fragments sent by the agent. The agent generates these fragments using `define-template.ts` patterns. But unlike a traditional web app with fixed templates, in this model **screens can be generated dynamically** and user templates can be saved.

The risk: a user could write a template that includes malicious script content. Even though `Controller.ts` uses `setHTMLUnsafe` (which doesn't execute inline scripts), XSS via event handlers (`onclick`) or `href="javascript:..."` is still possible.

### Proposed approach: `ProvisionedTemplate<T>`

Building on `define-template.ts`:

```ts
import { defineTemplate } from 'plaited/ui'
import { provision } from 'plaited/agent'

// Prebuilt extension (developer-authored, trusted)
const CardTemplate = defineTemplate({
  inputSchema: z.object({
    title: z.string().max(200),
    description: z.string().max(500).optional(),
    assignee: z.string().optional(),
  }),
  template: ({ attrs }) => html`<div class="card">
    <h3>${attrs.title}</h3>
    ${attrs.description ? html`<p>${attrs.description}</p>` : ''}
  </div>`,
})

// User-saved template (provisioned, sandboxed)
const userCardLayout = provision(`
  <div class="card" style="border-color: {{color}}">
    <h3>{{title}}</h3>
    <p>{{description}}</p>
  </div>
`, {
  schema: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    title: z.string().max(200),
    description: z.string().max(500),
  }),
  // No arbitrary attributes — only safe HTML + CSS
  allow: ['div', 'h3', 'p', 'span', 'img'],
  sanitize: true,
})
```

**Key safety properties:**

- **No `<script>` or event handler attributes** — stripped by the provisioner
- **Schema-enforced inputs** — all interpolation values validated against Zod
- **Allow-listed HTML tags** — only safe presentational tags
- **`setHTMLUnsafe` on the client** — even if something leaks, inline scripts won't execute (`setHTMLUnsafe` marks scripts as parser-inserted)

This is deliberately more restrictive than JSX or `innerHTML`. The trade-off is acceptable because:

1. Dynamic behavior comes from **extensions** (`p-trigger` + `ControllerExtension`), not from inline event handlers
2. Styling comes from CSSStyleSheet adoption (sent in `render` messages), not from inline `style` attributes
3. The agent controls what templates are provisioned — user-saved templates are an audit artifact, not executable code

---

## 7. The `@adapters/pi/` Package

The pi adapter bridges Plaited web-A2A agents with pi's SDK. It provides:

```ts
// @adapters/pi/index.ts

import { defineTool } from '@earendil-works/pi-coding-agent'
import type { Skill } from '../agent/types'

/**
 * Register a pi SDK session as an A2A skill.
 * The user's tool boundary determines which pi tools are exposed.
 */
export const createPiSkill = (config: {
  name: string
  description: string
  tools: string[]
  auth: { scope: string }
}): Skill => ({
  id: `pi:${config.name}`,
  name: config.name,
  description: config.description,
  tags: ['pi', config.auth.scope],
  execute: async (params, context) => {
    // context.user.boundaries determines if this skill is callable
    if (!context.boundaries.can(config.auth.scope)) {
      throw new Error('Insufficient permissions')
    }
    // Boot a pi session with restricted tools
    const { session } = await createAgentSession({
      tools: config.tools,
      sessionManager: SessionManager.inMemory(),
    })
    return session.prompt(params.input)
  },
})
```

This package also exports:

- **`piExtensionRuntime`** — wraps pi's `ExtensionRuntime` so Pi extensions can be loaded as A2A skills
- **`piEventBridge`** — maps pi's `AgentSessionEvent` stream to behavioral `Trigger` events
- **`piAuthAdapter`** — delegates authentication to pi's `AuthStorage` for credential management

---

## 8. Dual-Agent Architecture

### The Browser App Bridge

The cross-origin problem is eliminated by design: the web page runs inside a **dedicated browser app** (iOS/Android native webview), not a generic browser tab. All `postMessage` communication uses `self.origin` — the page and the browser app share the same origin. The browser app bridges `postMessage` to the device-local agent.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Device                                                                  │
│                                                                         │
│  ┌──────────────────────── Browser App ────────────────────────────┐    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────┐  ┌──────────────────┐  │    │
│  │  │ Web Page (webview)                   │  │ Device-Local     │  │    │
│  │  │                                      │  │ Agent            │  │    │
│  │  │  ┌──────────────────────┐            │  │                  │  │    │
│  │  │  │ Controller.ts        │            │  │ (pi SDK, tools,  │  │    │
│  │  │  │                      │            │  │  local LLM,      │  │    │
│  │  │  │ p-trigger → WebSock  │            │  │  file access)    │  │    │
│  │  │  │ render ← WebSocket   │            │  │                  │  │    │
│  │  │  │ postMessage(self.origin) ────────▶│  │  postMessage     │  │    │
│  │  │  │ ◀──────────────────── postMessage │  │  (self.origin)   │  │    │
│  │  │  └──────────────────────┘            │  └────────┬─────────┘  │    │
│  │  └──────────────────┬──────────────────┘           │              │    │
│  └─────────────────────┼──────────────────────────────┼──────────────┘    │
│                        │ WebSocket                    │                    │
│                        ▼                              │                    │
│             ┌──────────────────────┐                   │                    │
│             │ Hono Web Server      │                   │                    │
│             │ (Server-Side Agent)  │                   │                    │
│             │                      │                   │                    │
│             │ Behavioral Spec      │                   │                    │
│             │ A2A Handler          │                   │                    │
│             │ Topic Memory         │                   │                    │
│             │ HTML View Generation │                   │                    │
│             └──────────────────────┘                   │                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key properties:**

1. **Same origin.** The page, the browser app bridge, and the device-local agent all use `self.origin`. No CORS, no cross-origin restrictions, no `postMessage` origin filtering beyond `self.origin`.

2. **Two agents, one bridge.**
   - **Server-side agent** (Hono) — runs the behavioral spec, owns topic memory, generates HTML views. Limited by user scope/role/boundaries. Accessed via WebSocket from the page.
   - **Device-local agent** — runs on the user's device. Has local tools (pi SDK, file access, local LLM). Communicates with the page via `postMessage(self.origin)` through the browser app bridge.

3. **Controller.ts is the hub.** It forwards:
   - `p-trigger` events → WebSocket → server agent (for rendering)
   - `postMessage` A2A tasks → WebSocket → server agent (for skills)
   - Server agent A2A results → `postMessage` → device-local agent (for client-side processing)
   - Device-local agent A2A tasks → WebSocket → server agent (cross-device coordination)

4. **Works on iOS and Android.** Native webview apps on both platforms support `postMessage` at `self.origin` and WebSocket connections to remote servers.

### Data Flow: User Clicks "Create Card"

```
1. Browser: click on p-trigger="click:create_card"
2. Controller.ts: WebSocket → { type: "ui_event", detail: { event: { type: "click:create_card", topic: "board:project-42", detail: { title: "New card" } } } }
3. Hono Agent: behavioral spec matches waitFor type "click:create_card" on topic "board:project-42"
4. Spec: request → { type: "card_created", topic: "board:project-42", detail: { title: "New card" } }
5. Auth boundary check: does user have "create_card" permission on this topic? Yes.
6. Business logic: insert card into database, append to topic memory
7. Template: defineTemplate("card") with user's provisioned layout
8. Hono Agent: WebSocket → { type: "render", detail: { target: "board", html: "<div class='card'>...</div>", swap: "beforeend" } }
9. Controller.ts: #performSwap → appends card to board
```

### Data Flow: Client Agent Invokes "create_card" via web-A2A

```
1. Client Agent: window.postMessage({ jsonrpc: "2.0", method: "task/send", params: { id, skill: "create_card", message: { role: "user", parts: [{ data: { title: "New card", topic: "board:project-42" } }] } } })
2. Controller.ts: #a2aMessageListener → WebSocket → { type: "a2a_task", detail: { taskId: id, skill: "create_card", message: {...} } }
3. Hono Agent: behavioral spec matches a2a_task for skill "create_card" on topic
4. Remote agent boundary check: is this client agent allowed to create cards? Yes.
5. Same business logic + render flow as above
6. Hono Agent: WebSocket → { type: "a2a_result", detail: { taskId: id, state: "completed", parts: [...] } }
7. Controller.ts: window.postMessage → client agent receives result
```

---

## 9. Open Research Questions

1. **Topic-to-route mapping** — Does each topic have a canonical URL (e.g., `/topic/:id`), or can topics span multiple routes? How does the server agent know which topic a WebSocket connection belongs to?

2. **Device-local agent capabilities** — What subset of pi SDK tools should the device-local agent expose? Should it have `bash`/`write` (dangerous on device) or only `read`/`search`? How does the browser app configure this?

3. **`postMessage` payload schema** — The device-local agent and the server agent both communicate via `postMessage` through the Controller. Do they share the same web-A2A message schema, or is there a routing discriminator that tells the Controller which agent a message is for?

4. **Browser app lifecycle** — When the browser app goes to background (iOS) or is killed, does the WebSocket to the server agent persist? Should the device-local agent cache pending A2A tasks for reconnection?

5. **Template storage** — User-saved templates need persistent storage. Does this live in the same DB as the application data, or a separate template store? On-device or server-side?

6. **Behavioral spec composition** — A page with a kanban board AND a chat widget needs two specs merged. Should specs be composable (merge `syncPoints`), or should the server agent use a dispatcher that routes events to the right spec?

7. **pi session lifecycle on device** — When the device-local agent invokes a pi skill, should the pi session persist across page navigations? Across app restarts? Topic-keyed memory suggests yes, but pi sessions are file-based.