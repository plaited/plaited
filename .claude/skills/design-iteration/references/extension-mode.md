# Browser Extension Mode

Using your existing browser with extensions for design iteration.

## Overview

Browser Extension mode uses the `playwright-extension` MCP which connects to your existing browser instead of launching a new one. This is useful when you need:

- Browser extensions loaded
- Existing authentication state
- Specific browser configuration

## Prerequisites

### 1. Browser Extension Bridge

You must install the browser extension bridge from the Playwright MCP project:

**Setup Guide**: https://github.com/microsoft/playwright-mcp/blob/main/extension/README.md

### 2. MCP Configuration

The `playwright-extension` MCP should be configured in your Claude settings or marketplace.json:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "bunx",
      "args": ["@anthropic-ai/mcp-playwright-extension"]
    }
  }
}
```

### 3. Version Compatibility

Keep the extension bridge version in sync with the `@playwright/mcp` package version. Update both when upgrading.

## Workflow

### Step 1: Start Extension Bridge

Follow the browser extension setup guide to start the bridge connection.

### Step 2: Start Dev Server

```bash
bun plaited dev src/components --port 3000
```

### Step 3: Navigate in Your Browser

Use the same Playwright MCP tools, but they control your existing browser:

```typescript
await mcp__playwright__browser_navigate({
  url: 'http://localhost:3000/@story/...'
})
```

### Step 4: Iterate

Same workflow as Playwright mode - screenshots, snapshots, and edits.

## When to Use

### Use Extension Mode When:

- **Testing with extensions** - React DevTools, accessibility tools
- **Authenticated sessions** - Already logged into services
- **Specific browser setup** - Bookmarks, history, cookies
- **Manual inspection** - Want to use browser DevTools

### Avoid Extension Mode When:

- **Clean environment needed** - Use Playwright for isolated testing
- **Automated testing** - Use Test Video mode
- **Quick preview** - Playwright mode is simpler

## Comparison with Playwright Mode

| Aspect | Playwright | Extension |
|--------|------------|-----------|
| Browser | New headless | Your existing |
| Extensions | None | All loaded |
| Auth state | Fresh | Your sessions |
| Setup | None | Bridge required |
| Isolation | Full | Shared with you |

## Troubleshooting

### Connection Issues

If the extension bridge isn't connecting:
1. Check the extension is installed and enabled
2. Verify the MCP server is running
3. Restart the browser and extension

### Version Mismatch

If tools aren't working as expected:
1. Update both extension and MCP package
2. Clear browser extension cache
3. Reinstall the extension

## Example Use Case

Testing a component that requires OAuth authentication:

1. Log into the OAuth provider in your browser
2. Start extension bridge
3. Navigate to story that uses authenticated API
4. Component works because it has your auth cookies
5. Iterate on design with real data
