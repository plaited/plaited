# Chrome DevTools Mode

Using Chrome DevTools Protocol for browser automation during design iteration.

## Overview

Chrome DevTools mode uses the `chrome-devtools` MCP for browser automation. This provides visual feedback through screenshots and accessibility tree snapshots.

## Prerequisites

The `chrome-devtools` MCP server should be configured in your Claude settings. It's included in the Plaited plugin marketplace.json.

## Workflow

### Step 1: Start Dev Server

Use live-preview or start manually:

```bash
bun plaited dev src/templates --port 3000
```

### Step 2: Get Story URL

```bash
bun query-story-url.ts src/button.stories.tsx PrimaryButton
```

### Step 3: Navigate to Story

```typescript
await mcp__chrome-devtools__navigate_page({
  url: 'http://localhost:3000/@story/...'
})
```

### Step 4: Take Screenshot

```typescript
await mcp__chrome-devtools__take_screenshot({
  filename: 'button-initial.png'
})
```

### Step 5: Make Changes

Edit files (tokens, styles, template). Hot reload will update the browser.

### Step 6: Take New Screenshot

```typescript
await mcp__chrome-devtools__take_screenshot({
  filename: 'button-updated.png'
})
```

## Chrome DevTools MCP Tools

### Navigation

```typescript
// Navigate to URL
await mcp__chrome-devtools__navigate_page({ url: storyUrl })

// Create new page
await mcp__chrome-devtools__new_page({ url: storyUrl })

// List open pages
await mcp__chrome-devtools__list_pages({})
```

### Screenshots

```typescript
// Viewport screenshot
await mcp__chrome-devtools__take_screenshot({ filename: 'preview.png' })

// Full page screenshot
await mcp__chrome-devtools__take_screenshot({
  filename: 'full.png',
  fullPage: true
})

// Element screenshot (use uid from take_snapshot)
await mcp__chrome-devtools__take_screenshot({
  filename: 'element.png',
  uid: 'element-uid'
})
```

### Accessibility Tree Snapshot

```typescript
// Get accessibility tree (provides element uids for interaction)
await mcp__chrome-devtools__take_snapshot({})
```

### Interaction

```typescript
// Click element (uid from take_snapshot)
await mcp__chrome-devtools__click({ uid: 'button-uid' })

// Fill text field
await mcp__chrome-devtools__fill({
  uid: 'input-uid',
  value: 'test@example.com'
})

// Hover
await mcp__chrome-devtools__hover({ uid: 'tooltip-trigger-uid' })

// Press key
await mcp__chrome-devtools__press_key({ key: 'Enter' })
```

### JavaScript Evaluation

```typescript
// Run JavaScript in page context
await mcp__chrome-devtools__evaluate_script({
  code: 'document.title'
})
```

## Best Practices

1. **Use take_snapshot first** - Get accessibility tree with element uids for interaction
2. **Take before/after screenshots** - Document changes
3. **Test hover states** - Use hover before screenshot
4. **Check both themes** - Navigate with different color-scheme

## Example Session

```typescript
// Navigate to story
await mcp__chrome-devtools__navigate_page({
  url: 'http://localhost:3000/@story/button/primary'
})

// Get accessibility tree with element references
await mcp__chrome-devtools__take_snapshot({})

// User: "Make the button rounder"
// Agent: Edits button.css.ts to increase border-radius

// Hot reload updates browser
await mcp__chrome-devtools__take_screenshot({
  filename: 'button-rounded.png'
})

// User: "Perfect!"
```
