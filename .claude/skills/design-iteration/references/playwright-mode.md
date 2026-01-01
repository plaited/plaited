# Playwright Mode

Using headless browser automation for design iteration.

## Overview

Playwright mode uses the `playwright` MCP for headless browser automation. This provides fast visual feedback through screenshots and accessibility snapshots.

## Prerequisites

The `playwright` MCP server should be configured in your Claude settings. It's included in the Plaited plugin marketplace.json.

## Workflow

### Step 1: Start Dev Server

Use live-preview or start manually:

```bash
bun plaited dev src/components --port 3000
```

### Step 2: Get Story URL

```bash
bun query-story-url.ts src/button.stories.tsx PrimaryButton
```

### Step 3: Navigate to Story

```typescript
await mcp__playwright__browser_navigate({
  url: 'http://localhost:3000/@story/...'
})
```

### Step 4: Take Screenshot

```typescript
await mcp__playwright__browser_take_screenshot({
  filename: 'button-initial.png'
})
```

### Step 5: Make Changes

Edit files (tokens, styles, template). Hot reload will update the browser.

### Step 6: Take New Screenshot

```typescript
await mcp__playwright__browser_take_screenshot({
  filename: 'button-updated.png'
})
```

## Playwright MCP Tools

### Navigation

```typescript
// Navigate to URL
await mcp__playwright__browser_navigate({ url: storyUrl })

// Go back
await mcp__playwright__browser_navigate_back({})
```

### Screenshots

```typescript
// Viewport screenshot
await mcp__playwright__browser_take_screenshot({ filename: 'preview.png' })

// Full page screenshot
await mcp__playwright__browser_take_screenshot({
  filename: 'full.png',
  fullPage: true
})

// Element screenshot
await mcp__playwright__browser_take_screenshot({
  filename: 'element.png',
  ref: 'element-ref',
  element: 'Button element'
})
```

### Accessibility Snapshot

```typescript
// Get accessibility tree
const snapshot = await mcp__playwright__browser_snapshot({})

// Save to file
await mcp__playwright__browser_snapshot({ filename: 'a11y.md' })
```

### Interaction

```typescript
// Click element
await mcp__playwright__browser_click({
  ref: 'button-ref',
  element: 'Submit button'
})

// Type text
await mcp__playwright__browser_type({
  ref: 'input-ref',
  element: 'Email input',
  text: 'test@example.com'
})

// Hover
await mcp__playwright__browser_hover({
  ref: 'tooltip-trigger',
  element: 'Help icon'
})
```

## Best Practices

1. **Use accessibility snapshot** - Better than screenshot for understanding structure
2. **Take before/after screenshots** - Document changes
3. **Test hover states** - Use hover before screenshot
4. **Check both themes** - Navigate with different color-scheme

## Example Session

```typescript
// Navigate to story
await mcp__playwright__browser_navigate({
  url: 'http://localhost:3000/@story/button/primary'
})

// Get initial snapshot
await mcp__playwright__browser_snapshot({})

// User: "Make the button rounder"
// Agent: Edits button.css.ts to increase border-radius

// Hot reload updates browser
await mcp__playwright__browser_take_screenshot({
  filename: 'button-rounded.png'
})

// User: "Perfect!"
```
