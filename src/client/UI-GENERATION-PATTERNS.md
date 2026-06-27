# UI Generation Patterns

> How to generate dynamic UI from a database without writing new files.
> Architecture patterns for agent-driven HTML rendering through Plaited's
> existing template registry and controller protocol.

---

## Premise

You have only a database and Plaited's existing primitives — no ability to
write new files at runtime. You need to generate interactive UI on an HTML
page served by a behavioral agent over WebSocket.

The core insight:

> **Do not generate UI files. Generate a validated UI projection object from
> DB state, then render that projection through a pre-registered
> template/style/token registry into the controller's existing `render` /
> `attrs` message shape.**

Agent creativity happens in **JSON/data**, not in new TS/HTML files.

---

## 1. The Controller Protocol Contract

The browser controller (`Controller` in `controller.ts`) accepts server
messages over WebSocket. All UI operations must be expressed through these
two message types.

### 1.1 `render` — structural DOM changes

```ts
{
  type: 'render',
  detail: {
    id: string,           // unique correlation id
    target: string,       // matches [p-target="..."] on the page
    html: string,         // the rendered HTML fragment
    stylesheets: string[],// CSS text strings adopted via CSSStyleSheet
    swap: 'innerHTML' | 'outerHTML' | 'beforebegin' | 'afterbegin'
        | 'beforeend' | 'afterend',
    registry: string[],   // module paths for lazy-loaded controller bundles
  },
}
```

The controller finds `document.querySelector(`[p-target="${target}"]`)` and
swaps the HTML into that element per the `swap` mode.

### 1.2 `attrs` — lightweight attribute mutations

```ts
{
  type: 'attrs',
  detail: {
    id: string,
    target: string,
    attr: Record<string, string | number | boolean | null>,
  },
}
```

Use this for loading states, disabling buttons, toggling `hidden`, updating
`aria-*`, setting `data-*` values — anything that doesn't require a full
re-render.

### 1.3 Outbound: client to server

All user interactions arrive as WebSocket messages matching `ClientMessage`:

```ts
// ui_event — triggered by p-trigger
{
  type: 'ui_event',
  detail: {
    event: { type: string, detail?: Record<string, string> },
  },
}

// form_submit — automatic for <form> elements
{
  type: 'form_submit',
  detail: {
    id: string | null,
    action: string | null,
    method: string,
    data: Record<string, string | string[]>,
  },
}
```

---

## 2. Architecture Overview

Four layers, one direction:

```txt
Database
    ↓
Domain / View Model
    ↓
UI Plan / Projection Object
    ↓
Template Registry Renderer
    ↓
Controller RenderMessage / AttrsMessage
    ↓
WebSocket
    ↓
Browser Controller
```

The agent reads from the DB, decides *what* to render, then expresses that
decision as a *plan* (not HTML). The renderer converts the plan into safe
HTML + stylesheets + the correct message envelope.

---

## 3. Pattern: Static Template Registry

Maintain a registry of developer-authored templates. The agent selects from
this registry by ID — it never creates new template functions.

```ts
// template-registry.ts
import { h, fragment, type TemplateObject } from './template.ts'
import { SWAP_MODES } from '../shared/shared.constants.ts'

const templateRegistry = {
  page: PageTemplate,
  card: CardTemplate,
  table: TableTemplate,
  form: FormTemplate,
  emptyState: EmptyStateTemplate,
  dashboard: DashboardTemplate,
  modal: ModalTemplate,
  toast: ToastTemplate,
  toolbar: ToolbarTemplate,
  button: ButtonTemplate,
  badge: BadgeTemplate,
  metricCard: MetricCardTemplate,
} as const

type TemplateId = keyof typeof templateRegistry
```

A small adapter converts a plan into the controller's wire format:

```ts
function renderMessage(args: {
  id?: string
  template: TemplateId
  attrs?: Record<string, unknown>
  target: string
  swap?: keyof typeof SWAP_MODES
}): RenderMessage {
  const template = templateRegistry[args.template]
  const tpl = h(template, args.attrs ?? {})

  return {
    type: 'render',
    detail: {
      id: args.id ?? crypto.randomUUID(),
      target: args.target,
      html: tpl.html.join(''),
      stylesheets: [...new Set(tpl.stylesheets)],
      swap: args.swap ?? 'innerHTML',
      registry: [],
    },
  }
}
```

This is the core connective tissue. The agent never writes a file — it writes:

```ts
{ template: 'table', target: 'main', swap: 'innerHTML', attrs: { rows: [...] } }
```

---

## 4. Pattern: DB-Backed UI Recipes

Let the database contain a **screen recipe** — a declarative description of
what to render. The recipe is JSON, not HTML.

```json
{
  "target": "main",
  "swap": "innerHTML",
  "template": "dashboard",
  "attrs": {
    "title": "Project Overview",
    "sections": [
      {
        "template": "metricCard",
        "attrs": {
          "label": "Open Tasks",
          "valueFrom": "tasks.open_count",
          "tone": "accent"
        }
      },
      {
        "template": "table",
        "attrs": {
          "title": "Recent Activity",
          "rowsFrom": "activity.recent"
        }
      }
    ]
  }
}
```

At runtime:

1. Query the recipe from DB.
2. Resolve `valueFrom` / `rowsFrom` against actual data.
3. Validate template IDs and attrs against Zod schemas.
4. Render each node through the registry.
5. Send the `render` message to the controller.

```ts
// resolve-plugin
type Resolver = (recipe: UiRecipe, context: { db: D1Database }) => Promise<AttrsMessage>

const resolvers: Record<string, Resolver> = {
  valueFrom: (recipe, ctx) => {
    const value = resolvePath(ctx.db, recipe.attrs.valueFrom)
    return { ...recipe.attrs, value }
  },
  rowsFrom: (recipe, ctx) => {
    const rows = resolvePath(ctx.db, recipe.attrs.rowsFrom)
    return { ...recipe.attrs, rows }
  },
}
```

This gives the agent room to compose UI by writing JSON to a DB table — no
file writes required.

---

## 5. Pattern: Component AST for Maximum Flexibility

If you want the agent to generate highly variable layouts without new files,
give it a small set of generic primitives:

- `Page`
- `Stack`
- `Grid`
- `Section`
- `Card`
- `Text`
- `Button`
- `Form`
- `Input`
- `Table`
- `List`
- `Badge`
- `Dialog`
- `EmptyState`

Then allow the agent to output a **JSON tree** (a UI AST):

```ts
type UiNode = {
  template: string
  attrs?: Record<string, unknown>
  children?: UiNode[]
}
```

Example:

```json
{
  "template": "Page",
  "attrs": { "title": "Customers" },
  "children": [
    {
      "template": "Toolbar",
      "children": [
        {
          "template": "Button",
          "attrs": {
            "label": "Add Customer",
            "trigger": "customer.create.open"
          }
        }
      ]
    },
    {
      "template": "Table",
      "attrs": {
        "columns": ["Name", "Email", "Status"],
        "rowsFrom": "customers.list"
      }
    }
  ]
}
```

One interpreter converts the tree into a single `TemplateObject`:

```ts
function renderNode(node: UiNode): TemplateObject {
  const tpl = templateRegistry[node.template as TemplateId]
  if (!tpl) throw new Error(`Unknown template: ${node.template}`)

  const children = node.children?.length
    ? fragment(node.children.map(renderNode))
    : undefined

  return h(tpl, { ...node.attrs, children })
}
```

Then wrap in a `render` message:

```ts
function renderTree(args: {
  target: string
  swap?: keyof typeof SWAP_MODES
  node: UiNode
}): RenderMessage {
  const tpl = renderNode(args.node)
  return {
    type: 'render',
    detail: {
      id: crypto.randomUUID(),
      target: args.target,
      html: tpl.html.join(''),
      stylesheets: [...new Set(tpl.stylesheets)],
      swap: args.swap ?? 'innerHTML',
      registry: [],
    },
  }
}
```

This is the strongest pattern for the "no file writes" constraint. The agent
composes existing primitives into new layouts using nothing but JSON.

---

## 6. Pattern: Stable Target Shell

The initial HTML page should be served with stable `p-target` containers.
The agent should only update known targets — never invent new ones without
a template providing them.

```ts
// page-shell.ts
import { defineTemplate, h } from './define-template.ts'

const shell = () =>
  h('html', {
    children: [
      h('head', {
        children: h('title', { children: 'Plaited App' }),
      }),
      h('body', {
        children: [
          h('main', { 'p-target': 'main', children: '' }),
          h('aside', { 'p-target': 'sidepanel', hidden: true }),
          h('div', { 'p-target': 'modal' }),
          h('div', { 'p-target': 'toast' }),
          h('div', { 'p-target': 'status' }),
        ],
      }),
    ],
  })
```

Recommended stable targets:

| Target      | Purpose                        |
|-------------|--------------------------------|
| `main`      | Primary content area           |
| `modal`     | Overlay dialogs                |
| `toast`     | Transient notifications        |
| `sidepanel` | Secondary / detail panel       |
| `status`    | Inline status / progress bars  |

```ts
const STABLE_TARGETS = ['main', 'modal', 'toast', 'sidepanel', 'status'] as const
type StableTarget = (typeof STABLE_TARGETS)[number]
```

---

## 7. Pattern: Semantic Event Bridge

Templates should emit semantic `p-trigger` actions, not low-level UI names.

```ts
// Good — semantic
h('button', {
  [P_TRIGGER]: { click: 'customer.create.open' },
  children: 'Add customer',
})

// Good — carries domain data
h('td', {
  [P_TRIGGER]: { click: 'invoice.pay.requested' },
  'data-invoice-id': invoice.id,
  children: 'Pay',
})
```

The server-side bridge unwraps controller messages into behavioral events:

```ts
// event-bridge.ts
addHandler(CONTROLLER_TO_AGENT_EVENTS.ui_event, (detail) => {
  // detail.event is the BPEvent from p-trigger
  trigger(detail.event)
})

addHandler(CONTROLLER_TO_AGENT_EVENTS.form_submit, (detail) => {
  // Normalize form data into a semantic event
  trigger({
    type: `form.${detail.id}.submitted`,
    detail: detail.data,
  })
})
```

Then behavioral specs work with domain semantics:

```ts
useSpec({
  label: 'customer-flow',
  thread: {
    syncPoints: [
      {
        waitFor: [{ type: 'customer.create.open' }],
        request: { type: 'ui.show_create_modal' },
      },
      {
        waitFor: [{ type: 'customer.form.submitted' }],
        request: { type: 'customer.create' },
      },
    ],
  },
})
```

Data flow:

```txt
p-trigger { click: "customer.create.open" }
    ↓
controller sends ui_event { event: { type: "customer.create.open" } }
    ↓
server unwraps → behavioral.trigger({ type: "customer.create.open" })
    ↓
behavioral spec matches waitFor → request → handler fires
    ↓
handler queries DB → selects template → builds render message → sends
```

---

## 8. Pattern: Behavioral for Orchestration, Projections for UI

Separate concerns clearly:

- **Behavioral**: sequencing, permission boundaries, human-in-the-loop
  interrupts, workflow state, choosing the next semantic event.

- **Projection handlers**: reading DB, building view models, selecting
  templates, rendering controller messages.

```ts
// ── Behavioral orchestration ──

addHandler('controller_connected', async () => {
  trigger({ type: 'ui.project.main' })
})

addHandler('customer.create.open', async () => {
  trigger({ type: 'ui.project.customer_create_modal' })
})

addHandler('customer.created', async () => {
  trigger({ type: 'ui.project.customer_list' })
  trigger({ type: 'ui.toast', detail: { message: 'Customer created', tone: 'success' } })
})

// ── Projection handlers ──

addHandler('ui.project.main', async () => {
  const customers = await db.query.customers.findMany()
  const msg = renderMessage({
    target: 'main',
    template: 'customerTable',
    attrs: { customers },
  })
  socket.send(JSON.stringify(msg))
})

addHandler('ui.project.customer_create_modal', async () => {
  const msg = renderMessage({
    target: 'modal',
    template: 'customerForm',
    attrs: { mode: 'create' },
    swap: 'innerHTML',
  })
  socket.send(JSON.stringify(msg))
})

addHandler('ui.toast', async ({ message, tone }) => {
  const msg = renderMessage({
    target: 'toast',
    template: 'toast',
    attrs: { message, tone },
    swap: 'beforeend',
  })
  socket.send(JSON.stringify(msg))
})
```

This separation keeps the system understandable. Behavioral specs answer
*when* and *why*; projection handlers answer *what HTML*.

---

## 9. Pattern: attrs Messages for Small State Changes

For lightweight UI updates, avoid re-rendering. Use the `attrs` message.

```ts
function attrsMessage(params: {
  target: string
  attr: Record<string, string | number | boolean | null>
}): AttrsMessage {
  return {
    type: 'attrs',
    detail: {
      id: crypto.randomUUID(),
      target: params.target,
      attr: params.attr,
    },
  }
}
```

Good candidates for `attrs`:

| Use case                    | Example                                    |
|-----------------------------|--------------------------------------------|
| Loading state              | `{ disabled: true, 'aria-busy': 'true' }` |
| Toggle visibility          | `{ hidden: true }`                         |
| Update `aria-*`            | `{ 'aria-expanded': 'true' }`             |
| Mark selected              | `{ 'data-selected': 'true' }`             |
| Error state                | `{ 'aria-invalid': 'true' }`             |
| Disable during submission  | `{ disabled: true }`                       |

```ts
// Usage
socket.send(JSON.stringify(attrsMessage({
  target: 'submitButton',
  attr: { disabled: true, 'aria-busy': 'true' },
})))
```

---

## 10. Pattern: Semantic Style Tokens

Templates own actual CSS styles. The agent selects from semantic style
options only — no arbitrary CSS injection.

```ts
// Define semantic axes
type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
type Density = 'compact' | 'comfortable'
type Emphasis = 'quiet' | 'normal' | 'strong'
```

Bad (arbitrary CSS injection):

```json
{
  "style": "background: red; position: fixed; z-index: 999999"
}
```

Good (semantic selection):

```json
{
  "tone": "danger",
  "emphasis": "strong"
}
```

Inside templates, map semantic choices to actual styles:

```ts
import { createStyles, joinStyles } from './styles.ts'
import { createTokens } from './tokens.ts'

const tokens = createTokens('app', {
  color: {
    dangerBg: { $value: '#fef2f2' },
    dangerBorder: { $value: '#fca5a5' },
    successBg: { $value: '#f0fdf4' },
    // ...
  },
})
const { color } = tokens

const styles = createStyles({
  card: {
    border: '1px solid var(--app-color-neutral-border)',
    borderRadius: '8px',
    padding: '16px',
  },
  dangerCard: {
    backgroundColor: color.dangerBg,
    borderColor: color.dangerBorder,
  },
  successCard: {
    backgroundColor: color.successBg,
    borderColor: color.successBorder,
  },
})

// In template:
export const CardTemplate = defineTemplate({
  inputSchema: z.object({
    tone: z.enum(['danger', 'success', 'neutral']).optional(),
    children: z.any(),
  }),
  template: ({ attrs, h, fragment }) => {
    const toneStyle = {
      danger: styles.dangerCard,
      success: styles.successCard,
      neutral: undefined,
    }[attrs.tone ?? 'neutral']

    return h('div', {
      ...joinStyles(styles.card, toneStyle),
      children: attrs.children,
    })
  },
})
```

This lets the agent make design decisions (tone, emphasis, density) without
arbitrary CSS.

---

## 11. Pattern: The Safest Agent Contract

Constrained the agent's output to a single validated shape. This creates a
clean security boundary.

```ts
// ── Agent output: only this shape ──

type UiProjection = {
  target: 'main' | 'modal' | 'toast' | 'sidepanel' | 'status'
  swap?: 'innerHTML' | 'outerHTML' | 'beforeend'
  node: UiNode
}

type UiNode = {
  template: string
  attrs?: Record<string, unknown>
  children?: UiNode[]
}

// ── Validate with Zod ──

const UiNodeSchema: z.ZodType<UiNode> = z.lazy(() =>
  z.object({
    template: z.enum(Object.keys(templateRegistry) as [TemplateId, ...TemplateId[]]),
    attrs: JsonObjectSchema.optional(),
    children: z.array(UiNodeSchema).optional(),
  })
)

const UiProjectionSchema = z.object({
  target: z.enum(STABLE_TARGETS),
  swap: z.enum(['innerHTML', 'outerHTML', 'beforeend', 'beforebegin', 'afterbegin', 'afterend'])
    .optional().default('innerHTML'),
  node: UiNodeSchema,
})
```

The flow:

```txt
Agent decision
    ↓
UiProjection (JSON)
    ↓
Zod validation
    ↓
renderTree() → TemplateObject → html + stylesheets
    ↓
RenderMessage
    ↓
JSON.stringify → WebSocket send
    ↓
Controller performs swap
```

This guarantees:

| Property            | Enforcement              |
|---------------------|--------------------------|
| No arbitrary HTML   | Templates in registry    |
| No inline scripts   | `setHTMLUnsafe` on client|
| No event handlers   | `p-trigger` only         |
| No arbitrary CSS    | Semantic style tokens    |
| No file writes      | All input is JSON        |
| Safe interpolation  | Zod schema validation    |

---

## 12. Pattern: Initial Render on Connection

When the controller's WebSocket opens, the agent should project the current
DB state into the UI immediately.

```ts
// agent.ts
addHandler('controller_connected', async () => {
  // Project initial state
  trigger({ type: 'ui.project.initial' })
})

// Or, for reconnection with state recovery:
addHandler('page.show', async () => {
  const snapshot = await db.getLastSnapshot()
  if (snapshot) {
    // Replay or rebase from snapshot
    trigger({ type: 'ui.project.from_snapshot', detail: snapshot })
  } else {
    trigger({ type: 'ui.project.initial' })
  }
})
```

The projection handler:

```ts
addHandler('ui.project.initial', async () => {
  const data = await db.query.currentState()
  const msg = renderMessage({
    target: 'main',
    template: 'dashboard',
    attrs: { data },
  })
  socket.send(JSON.stringify(msg))
})
```

This replaces the traditional SSR + hydration cycle with a **render on
connect** model. The initial HTML page is a shell with stable targets; the
real content arrives over WebSocket moments later.

---

## 13. Pattern: Mutation → Re-Projection

When data changes (user action, external event, schedule), follow the same
path: mutate the DB, then re-project the affected targets.

```ts
addHandler('customer.created', async ({ detail: { name, email } }) => {
  // 1. Mutate DB
  await db.insert.customers({ name, email, createdAt: new Date() })

  // 2. Re-project UI
  const customers = await db.query.customers.findMany()
  const msg = renderMessage({
    target: 'main',
    template: 'customerTable',
    attrs: { customers },
  })
  socket.send(JSON.stringify(msg))
})
```

For partial updates:

```ts
addHandler('customer.create.complete', async () => {
  // Close modal
  const hideModal = attrsMessage({
    target: 'modal',
    attr: { hidden: true },
  })
  socket.send(JSON.stringify(hideModal))

  // Update customer list
  const customers = await db.query.customers.findMany()
  const updateList = renderMessage({
    target: 'main',
    template: 'customerTable',
    attrs: { customers },
  })
  socket.send(JSON.stringify(updateList))

  // Show toast
  const toast = renderMessage({
    target: 'toast',
    template: 'toast',
    attrs: { message: 'Customer created', tone: 'success' },
    swap: 'beforeend',
  })
  socket.send(JSON.stringify(toast))
})
```

---

## 14. Pattern: Form Submission

Forms in Plaited are handled automatically. The controller intercepts `submit`
events and sends a `form_submit` message. On the server:

```ts
addHandler(CONTROLLER_TO_AGENT_EVENTS.form_submit, async (detail) => {
  const { id, action, method, data } = detail

  // Validate with Zod
  const parsed = CustomerFormSchema.parse(data)

  // Store in DB
  const customer = await db.insert.customers({
    name: parsed.name,
    email: parsed.email,
  })

  // Close form, show success
  trigger({ type: 'ui.project.customer_created', detail: { id: customer.id } })
})
```

The behavioral spec can enforce form flow without managing form state:

```ts
useSpec({
  label: 'customer-form',
  thread: {
    syncPoints: [
      {
        waitFor: [{ type: 'customer.create.open' }],
        request: { type: 'ui.show_create_form' },
      },
      {
        // Block duplicate submissions until form completes
        interrupt: [{ type: 'customer.create.open' }],
        block: [{ type: 'customer.create.open' }],
        waitFor: [{ type: 'customer.form.submitted' }],
        request: { type: 'customer.create' },
      },
    ],
  },
})
```

---

## 15. Gotchas & Edge Cases

### 15.1 Message envelope shape

The controller expects the **entire server message**, not just the detail:

```ts
// ✅ Correct
socket.send(JSON.stringify({
  type: 'render',
  detail: { id, target, html, stylesheets, swap, registry },
}))

// ❌ Wrong — controller will reject with "invalid_union"
socket.send(JSON.stringify({
  target: 'main',
  html: '...',
}))
```

### 15.2 Security: no inline event handlers

The template system (`h` function) throws on `on*` attributes. Do not bypass
this — all interactivity must use `p-trigger`.

```ts
// ✅ Allowed
h('button', {
  [P_TRIGGER]: { click: 'customer.create.open' },
})

// ❌ Throws EventHandlerAttributeError
h('button', { onclick: 'alert(1)' })
```

### 15.3 Security: no inline scripts

`Controller.ts` uses `setHTMLUnsafe`, which marks inline `<script>` elements
as "parser-inserted" and prevents their execution. Combined with no `on*`
attributes in templates, this provides defense-in-depth.

### 15.4 Stylesheet deduplication

The controller deduplicates stylesheets per `Document` using a `WeakMap`.
Send the full CSS string each time; the controller will skip duplicates.

```ts
// Safe to send the same stylesheet on every render
const msg = renderMessage({
  target: 'main',
  template: 'customerTable',
  attrs: { customers },
})
// msg.detail.stylesheets may contain duplicates — controller handles it
```

### 15.5 Target elements must exist

The controller silently ignores render messages for non-existent targets:

```ts
// controller.ts: if (!element) return;
```

Ensure the initial HTML shell includes all targets you plan to use.

### 15.6 Form submission: prevent default

The controller calls `event.preventDefault()` on form submit. Do not set
`action` or `method` on forms expecting normal browser submission. Use
`p-target` on elements inside the form for validation feedback.

### 15.7 Swap mode expectations

- `innerHTML` replaces children — use for full content replacement.
- `outerHTML` replaces the target itself — use with caution (target is gone).
- `beforebegin` / `afterbegin` / `beforeend` / `afterend` insert without
  removing existing content — use for appending or interleaving.

### 15.8 Recovery on reconnect

When the WebSocket reconnects, re-project the full state. The controller
does not buffer missed renders. The simplest approach:

```ts
addHandler('controller_connected', async () => {
  await projectAll() // re-render all targets from DB
})
```

---

## 16. Recommended Implementation Module Structure

If implementing these patterns from scratch:

```txt
framework/src/ui/agent-adapter/
├── template-registry.ts     // Map<TemplateId, FunctionTemplate>
├── ui-plan.schema.ts        // Zod schema for UiProjection / UiNode
├── render-adapter.ts        // UiProjection → RenderMessage / AttrsMessage
├── event-bridge.ts          // ClientMessage → behavioral events
├── projection-handlers.ts   // semantic events → DB query → send render
├── target-constants.ts      // Stable target names
└── style-tokens.ts          // Semantic token/theme definitions
```

But the key insight is that none of these modules require new files at
runtime — they are all developer-authored, compile-time code.

The agent only writes **data** to the database. The data drives template
selection, composition, and rendering. No file writes needed.

---

## Appendix: Minimal End-to-End Flow

### Server bootstrap

```ts
import { behavioral, addHandler, trigger } from './behavioral.ts'
import { renderMessage, attrsMessage } from './agent-adapter/render-adapter.ts'

// When controller connects, send current state
addHandler('controller_connected', async () => {
  const items = await db.query.items.findMany()
  socket.send(JSON.stringify(renderMessage({
    target: 'main',
    template: 'list',
    attrs: { items },
  })))
})

// When user clicks "add" button
addHandler('item.create.open', async () => {
  socket.send(JSON.stringify(renderMessage({
    target: 'modal',
    template: 'itemForm',
    swap: 'innerHTML',
  })))
})

// When form is submitted
addHandler('item.form.submitted', async (data) => {
  await db.insert.items(data)
  socket.send(JSON.stringify(attrsMessage({
    target: 'modal',
    attr: { hidden: true },
  })))
  const items = await db.query.items.findMany()
  socket.send(JSON.stringify(renderMessage({
    target: 'main',
    template: 'list',
    attrs: { items },
  })))
  socket.send(JSON.stringify(renderMessage({
    target: 'toast',
    template: 'toast',
    attrs: { message: 'Item created', tone: 'success' },
    swap: 'beforeend',
  })))
})
```

### Browser shell

```html
<!DOCTYPE html>
<html>
<head>
  <script src="/.plaited/connect.js" type="module" async></script>
</head>
<body>
  <main p-target="main"></main>
  <div p-target="modal"></div>
  <div p-target="toast"></div>
</body>
</html>
```

### Template

```ts
// pre-registered, developer-authored
export const ListTemplate = defineTemplate({
  inputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['active', 'completed']),
    })),
  }),
  template: ({ attrs, h }) =>
    h('div', {
      children: [
        h('h2', { children: 'Items' }),
        h('button', {
          [P_TRIGGER]: { click: 'item.create.open' },
          children: 'Add Item',
        }),
        h('ul', {
          children: attrs.items.map((item) =>
            h('li', {
              'data-id': item.id,
              children: `${item.title} (${item.status})`,
            })
          ),
        }),
      ],
    }),
})
```

That's it. The agent reads `items` from the DB, selects the `List` template,
and the render adapter produces the correct WebSocket message. No file
writes, no arbitrary HTML, no security holes.
