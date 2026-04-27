---
name: add-app-to-server
description: This skill should be used when the user asks to "add an app to my MCP server", "add UI to my MCP server", "add a view to my MCP tool", "enrich MCP tools with UI", "add interactive UI to existing server", "add MCP Apps to my server", or needs to add interactive UI capabilities to an existing MCP server that already has tools. Uses Bun standalone HTML bundling for MCP App packaging and serving.
---

# Add UI to MCP Server (Bun Standalone HTML)

Enrich an existing MCP server's tools with interactive UIs using `@modelcontextprotocol/ext-apps`, packaged as Bun standalone HTML artifacts.

## Non-Negotiable Stack

- Use Bun commands (`bun add`, `bun build`, `bun run`)
- Use Bun standalone HTML bundling (`--compile --target=browser`)
- Do not use Vite or `vite-plugin-singlefile` for MCP App packaging

Reference docs:

- Bun standalone HTML: `https://bun.com/docs/bundler/standalone-html`
- Bun HTML/static workflow: `https://bun.com/docs/bundler/html-static#standalone-html`

## How It Works

Each App-enhanced tool keeps normal tool behavior and adds UI metadata:

1. Tool returns `content` (text fallback) and optional `structuredContent` (for UI)
2. Tool `_meta.ui.resourceUri` points to a registered HTML resource
3. Resource callback serves Bun-built standalone HTML
4. Host renders the HTML in a sandboxed iframe

## Mandatory Doctrine Workflow

For every server tool/resource/UI exposure, apply these required steps:

1. Classify each surface as `private lane` or `exchange lane`.
2. Define the boundary contract before exchange-lane exposure.
3. Define identity-plane checks and execution-plane enforcement separately.
4. Add entitlement checks for premium resources/services.
5. Clarify app-only tools vs model-visible tools under policy.
6. Add provenance/watermark guidance for premium media outputs.
7. Include fallback behavior for clients without full extension support.

Trust assertions are not runtime authority by themselves. Verified claims feed policy; execution authority is enforced at runtime boundaries.

## Step 1: Analyze Existing Tools

Before writing code, inspect the server and classify tools:

1. List all registered tools
2. Mark which tools benefit from UI
3. Identify app-only helper tools (`visibility: ["app"]`) for polling/chunk loading
4. Confirm selected targets with the user

Decision guide:

| Tool output type | UI benefit |
|---|---|
| Structured lists/tables | High |
| Metrics/time-series | High |
| Rich media/binary views | High |
| Simple confirmations | Low |
| Internal data loaders | App-only helper candidate |

## Step 2: Define Path + URI Contracts

For each tool UI, use explicit contracts and keep them stable:

- Source entry HTML: `apps/<app-slug>/mcp-app.html`
- Source code/assets: relative to that HTML
- Built artifact: `dist/apps/<app-slug>/mcp-app.html`
- Resource URI: `ui://<app-slug>/mcp-app.html`

Example for tool `show-map`:

- App slug: `show-map`
- Source: `apps/show-map/mcp-app.html`
- Build output: `dist/apps/show-map/mcp-app.html`
- Resource URI: `ui://show-map/mcp-app.html`

## Step 3: Install/Update Dependencies (Bun)

```bash
bun add @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk zod
bun add -d typescript @types/node
```

Add framework packages only when needed (`bun add react react-dom`, etc.).

## Step 4: Build App UI as Standalone HTML

### Entry HTML Pattern

Use relative references so Bun can inline everything local:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Show Map</title>
    <link rel="stylesheet" href="./src/mcp-app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./src/mcp-app.ts" type="module"></script>
  </body>
</html>
```

### Build Command

```bash
bun build --compile --target=browser \
  ./apps/show-map/mcp-app.html \
  --outdir=./dist/apps/show-map \
  --minify
```

What Bun standalone HTML does:

- Inlines local JS/TS/JSX into `<script type="module">`
- Inlines local CSS into `<style>`
- Inlines relative assets as `data:` URIs
- Leaves external absolute URLs as external

Implication: if your UI fetches CDN/API URLs, those are not inlined and still require MCP App domain metadata.

### Optional Scripts

```json
{
  "scripts": {
    "build:app:show-map": "bun build --compile --target=browser ./apps/show-map/mcp-app.html --outdir=./dist/apps/show-map --minify",
    "build:apps": "bun run build:app:show-map",
    "serve": "bun run server.ts"
  }
}
```

## Step 5: Convert Tool to App Tool

```typescript
import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

const resourceUri = "ui://show-map/mcp-app.html";

registerAppTool(
  server,
  "show-map",
  {
    description: "Display a map with interactive UI",
    inputSchema: { query: z.string() },
    _meta: { ui: { resourceUri } },
  },
  async ({ query }) => {
    const result = await geocodeAndFetchMap(query);
    return {
      content: [{ type: "text", text: `Map result for "${query}"` }],
      structuredContent: result,
    };
  },
);
```

Keep tools without UI value as plain MCP tools.

## Step 6: Register Bun-Built Resource

Use Bun file APIs instead of `node:fs`:

```typescript
import { join } from "node:path";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
} from "@modelcontextprotocol/ext-apps/server";

const appSlug = "show-map";
const resourceUri = `ui://${appSlug}/mcp-app.html`;
const bundledHtmlPath = join(
  import.meta.dir,
  "dist",
  "apps",
  appSlug,
  "mcp-app.html",
);

registerAppResource(
  server,
  {
    uri: resourceUri,
    name: "Show Map UI",
    mimeType: RESOURCE_MIME_TYPE,
  },
  async () => {
    const file = Bun.file(bundledHtmlPath);
    if (!(await file.exists())) {
      throw new Error(`Missing MCP App bundle: ${bundledHtmlPath}`);
    }
    const html = await file.text();
    return {
      contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);
```

## Step 7: UI Runtime Handlers

Register handlers before `connect()`:

```typescript
import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Show Map UI", version: "1.0.0" });

app.ontoolinput = (params) => {
  // Use params.arguments / params.structuredContent
};

app.ontoolresult = (result) => {
  // Render final state
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
};

await app.connect(new PostMessageTransport());
```

## Optional Enhancements

### App-Only Helper Tools

```typescript
registerAppTool(
  server,
  "poll-map-updates",
  {
    description: "Poll map updates for UI",
    _meta: { ui: { resourceUri, visibility: ["app"] } },
  },
  async () => {
    const data = await getLatestMapData();
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
);
```

### CSP/Domain Configuration

If the standalone UI uses external endpoints or embeds:

```typescript
registerAppResource(
  server,
  {
    uri: resourceUri,
    name: "Show Map UI",
    mimeType: RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        connectDomains: ["api.example.com"],
        resourceDomains: ["cdn.example.com"],
        frameDomains: ["maps.example.com"],
      },
    },
  },
  async () => {
    // return resource contents
  },
);
```

### Graceful Degradation for Non-UI Clients

Use `getUiCapability()` and register plain tool fallback when UI is unavailable.

### Streaming Input

Use `ontoolinputpartial` when tool input can be large or progressively generated.

## Common Mistakes to Avoid

1. Forgetting text fallback in `content`
2. Mismatching build output path vs resource read path
3. Leaving absolute external URLs unaccounted for in CSP/resource domain metadata
4. Registering handlers after `app.connect()`
5. Trying to use Vite-era build assumptions in Bun standalone flow

## Testing

### basic-host Smoke Test

```bash
# Terminal 1
bun run build:apps
bun run serve

# Terminal 2
git clone --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps
cd /tmp/mcp-ext-apps/examples/basic-host
bun install
SERVERS='["http://localhost:3001/mcp"]' bun run start
```

Verify:

1. Text-only tools still return useful output
2. App tools render in iframe
3. `ontoolinput` and `ontoolresult` handlers fire
4. Host style/theme variables apply
5. Built artifact path exists and is served without missing linked assets
