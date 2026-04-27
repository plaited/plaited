---
name: create-mcp-app
description: This skill should be used when the user asks to "create an MCP App", "add a UI to an MCP tool", "build an interactive MCP View", "scaffold an MCP App", or needs guidance on MCP Apps SDK patterns, UI-resource registration, MCP App lifecycle, or host integration. Uses Bun standalone HTML bundling as the default packaging model.
---

# Create MCP App (Bun Standalone HTML)

Build interactive UIs that run inside MCP-enabled hosts like Claude Desktop. An MCP App combines an MCP tool with an HTML resource to display rich, interactive content.

## Non-Negotiable Stack

For this repo direction:

- Use Bun for install/build/run commands
- Use Bun standalone HTML bundling, not Vite
- Bundle UI with `bun build --compile --target=browser ...`
- Serve the generated standalone `.html` via `registerAppResource()`

Reference docs:

- Bun standalone HTML: `https://bun.com/docs/bundler/standalone-html`
- Bun HTML/static bundler overview: `https://bun.com/docs/bundler/html-static#standalone-html`

## Core Concept: Tool + Resource

Every MCP App requires two linked parts:

1. **Tool** - Called by the model/host, returns data
2. **Resource** - Serves bundled HTML UI that renders that data

The tool's `_meta.ui.resourceUri` must match the resource URI.

Flow: host calls tool -> host resolves `resourceUri` -> server returns bundled HTML -> app renders result.

## Mandatory Doctrine Workflow

For each MCP App surface (tool, resource, UI), apply these required steps:

1. Classify every tool/resource/UI as `private lane` or `exchange lane`.
2. Define the boundary contract before exposing exchange-lane surfaces.
3. Define identity-plane checks and execution-plane enforcement separately.
4. Add entitlement checks for premium resources/services.
5. Clarify app-only tools vs model-visible tools under policy.
6. Add provenance/watermark guidance for premium media outputs.
7. Include fallback behavior for clients without full extension support.

Do not treat trust assertions as direct execution authority. Trust evidence informs policy; execution authority begins after policy approval.

## Bun Artifact Contract (Use This By Default)

Use explicit, stable paths so tooling and server code stay aligned:

- Source entry HTML: `apps/<app-slug>/mcp-app.html`
- Source scripts/styles/assets: referenced from that HTML using relative paths
- Built artifact: `dist/apps/<app-slug>/mcp-app.html`
- Resource URI: `ui://<app-slug>/mcp-app.html`

If you need multiple app UIs, use one `<app-slug>` directory per app and one build command per entry.

## Recommended Layout

```text
apps/weather-dashboard/
  mcp-app.html
  src/
    mcp-app.ts
    mcp-app.css
  assets/
    icon.svg
dist/apps/weather-dashboard/
  mcp-app.html
```

## Step 1: Pull Reference Code (SDK + Patterns)

Clone MCP Apps SDK examples:

```bash
git clone --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps
```

Useful references:

| File | Contents |
|------|----------|
| `src/app.ts` | `App` class, handlers (`ontoolinput`, `ontoolresult`, `onhostcontextchanged`, `onteardown`, etc.), lifecycle |
| `src/server/index.ts` | `registerAppTool`, `registerAppResource`, helper functions |
| `src/spec.types.ts` | UI host/context/style/CSP-related types |
| `src/styles.ts` | `applyDocumentTheme`, `applyHostStyleVariables`, `applyHostFonts` |
| `src/react/useApp.tsx` | `useApp` hook for React apps |

## Step 2: Install Dependencies with Bun

```bash
bun add @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk zod
bun add -d typescript @types/node
```

Add framework packages only if needed (for example `bun add react react-dom`).

## Step 3: Create Standalone HTML Entry

`mcp-app.html` should reference scripts/styles/assets with relative paths so Bun can inline them.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Weather Dashboard</title>
    <link rel="stylesheet" href="./src/mcp-app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./src/mcp-app.ts" type="module"></script>
  </body>
</html>
```

### Bun Standalone HTML Rules (Important)

From Bun docs, `bun build --compile --target=browser`:

- Inlines local scripts into `<script type="module">...</script>`
- Inlines local CSS into `<style>...</style>`
- Converts relative assets (images/fonts/etc.) to `data:` URIs
- Leaves absolute/external URLs unchanged

For MCP Apps this means:

- Keep app-local assets relative when you want one self-contained artifact
- Any external URL still needs appropriate MCP App CSP/resource domain metadata

### Handler Registration Order

Register ALL handlers BEFORE calling `app.connect()`:

```typescript
const app = new App({ name: "My App", version: "1.0.0" });

// Register handlers first
app.ontoolinput = (params) => { /* handle input */ };
app.ontoolresult = (result) => { /* handle result */ };
app.onhostcontextchanged = (ctx) => { /* handle context */ };
app.onteardown = async () => { return {}; };
// etc.

// Then connect
await app.connect(new PostMessageTransport());
```

## Step 4: Build Bun Standalone Artifact

```bash
bun build --compile --target=browser \
  ./apps/weather-dashboard/mcp-app.html \
  --outdir=./dist/apps/weather-dashboard \
  --minify
```

Generated artifact to serve:

- `dist/apps/weather-dashboard/mcp-app.html`

Optional local preview of the source app loop:

```bash
bun ./apps/weather-dashboard/mcp-app.html
```

## Step 5: Register Tool + Resource

```typescript
import { join } from "node:path";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

const appSlug = "weather-dashboard";
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
    name: "Weather Dashboard UI",
    mimeType: RESOURCE_MIME_TYPE,
  },
  async () => {
    const file = Bun.file(bundledHtmlPath);
    if (!(await file.exists())) {
      throw new Error(`Missing bundled app HTML: ${bundledHtmlPath}`);
    }
    const html = await file.text();
    return {
      contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);

registerAppTool(
  server,
  "show-weather-dashboard",
  {
    description: "Render forecast data in an interactive dashboard",
    inputSchema: { city: z.string() },
    _meta: { ui: { resourceUri } },
  },
  async ({ city }) => {
    const forecast = await fetchForecast(city);
    return {
      content: [{ type: "text", text: `Forecast for ${city}: ${forecast.summary}` }],
      structuredContent: { city, forecast },
    };
  },
);
```

## Step 6: Use Bun Scripts for Build/Serve

```json
{
  "scripts": {
    "build:app:weather-dashboard": "bun build --compile --target=browser ./apps/weather-dashboard/mcp-app.html --outdir=./dist/apps/weather-dashboard --minify",
    "build": "bun run build:app:weather-dashboard",
    "serve": "bun run server.ts"
  }
}
```

## Common Mistakes to Avoid

1. **No text fallback** - Always include `content` for non-UI hosts
2. **Wrong artifact path** - `registerAppResource()` path must match the Bun build outdir contract
3. **External URL assumptions** - only relative paths are inlined by Bun; external URLs remain external
4. **Handlers after `connect()`** - register all handlers first
5. **Skipping CSP metadata** - MCP Apps still need explicit domain declarations for network access

## Testing

### Using basic-host

Test MCP Apps locally with the basic-host example:

```bash
# Terminal 1: Build and run your server
bun run build && bun run serve

# Terminal 2: Run basic-host (from cloned repo)
cd /tmp/mcp-ext-apps/examples/basic-host
bun install
SERVERS='["http://localhost:3001/mcp"]' bun run start
# Open http://localhost:8080
```

Configure `SERVERS` with a JSON array of your server URLs (default: `http://localhost:3001/mcp`).

### Debug with sendLog

Send debug logs to the host application (rather than just the iframe's dev console):

```typescript
await app.sendLog({ level: "info", data: "Debug message" });
await app.sendLog({ level: "error", data: { error: err.message } });
```
