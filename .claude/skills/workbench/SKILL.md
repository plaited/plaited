---
name: workbench
description: Workshop workbench for discovering templates, previewing with hot reload, and iterating designs via test videos or browser automation. Supports light/dark color schemes.
license: ISC
compatibility: Requires bun
allowed-tools: Bash, Read, Edit, Write, Glob, mcp__chrome-devtools__*
---

# Workbench

Workshop workbench for discovering templates, previewing with hot reload, and iterating designs via test videos or browser automation.

## Purpose

This skill provides:
- **Discovery** - Find stories, bElements, and generate preview URLs
- **Preview** - Dev server with hot reload via CLI
- **Iteration** - Multi-modal design refinement with test videos or browser automation

## Quick Reference

| Capability | Command/Tool | Use Case |
|------------|--------------|----------|
| Discover stories | `query-stories.ts` | Find all `*.stories.tsx` files |
| Discover templates | `query-templates.ts` | Find all bElement exports |
| Generate URLs | `query-story-url.ts` | Get preview URL for a story |
| Batch analysis | `query-analyze.ts` | Combined discovery + URLs |
| Dev server | `bun plaited dev` | Hot reload preview |
| Test with video | `bun plaited test --record-video` | Visual test feedback |
| Browser automation | Chrome DevTools MCP | Screenshots, interaction |

## Discovery Scripts

### query-stories

Discover all stories in specified paths.

```bash
bun scripts/query-stories.ts <paths...>
```

**Example:**
```bash
bun scripts/query-stories.ts src/main
bun scripts/query-stories.ts src/components src/features
```

### query-templates

Discover all bElement exports in specified paths.

```bash
bun scripts/query-templates.ts <paths...>
```

**Example:**
```bash
bun scripts/query-templates.ts src/main
```

### query-story-url

Generate preview URLs for a story.

```bash
bun scripts/query-story-url.ts <file> <exportName> [--port <port>]
```

**Example:**
```bash
bun scripts/query-story-url.ts src/button.stories.tsx PrimaryButton
bun scripts/query-story-url.ts src/button.stories.tsx PrimaryButton --port 3500
```

### query-paths

Get route and entry path for a story export.

```bash
bun scripts/query-paths.ts <file> <exportName>
```

**Example:**
```bash
bun scripts/query-paths.ts src/button.stories.tsx PrimaryButton
```

### query-analyze

Batch analysis for discovering stories, templates, and generating URLs.

```bash
bun scripts/query-analyze.ts <paths...> [options]
```

**Options:**
- `--stories, -s` - Find all stories
- `--templates, -t` - Find all bElements
- `--urls, -u` - Generate URLs for discovered stories
- `--all` - Run all analyses (stories + templates + urls)
- `--port, -p` - Dev server port for URLs (default: 3000)

**Examples:**
```bash
# Full analysis
bun scripts/query-analyze.ts src/main --all

# Just stories with URLs
bun scripts/query-analyze.ts src/main --stories --urls

# Just templates
bun scripts/query-analyze.ts src/components --templates
```

## Dev Server

Start the dev server with hot reload:

```bash
bun --hot plaited dev [paths...] [-p <port>]
```

**Arguments:**
- `paths`: Directories to discover stories (default: current directory)
- `-p, --port`: Server port (default: 3000)

**Console Output:**
```
Discovering stories in: /path/to/project
Found 5 story exports
Server ready at http://localhost:3000
Hot reload enabled via WebSocket

BasicButton: http://localhost:3000/@story/...
PrimaryButton: http://localhost:3000/@story/...
```

The server outputs story URLs directly - parse stdout for programmatic access.

## Design Iteration

Two primary modes for iterating on template designs:

| Mode | Use Case | Tool | Requirements |
|------|----------|------|--------------|
| Test Video | Interaction stories with play functions | `bun plaited test --record-video` | None |
| Chrome DevTools | Browser automation, screenshots, inspection | `chrome-devtools` MCP | Chrome browser |

### References

- **[mode-selection.md](references/mode-selection.md)** - When to use each mode
- **[test-video-mode.md](references/test-video-mode.md)** - CLI with `--record-video`
- **[chrome-devtools-mode.md](references/chrome-devtools-mode.md)** - Browser automation

### Test Video Workflow

```bash
# Run tests with video recording (both color schemes)
bun plaited test src/components/button --record-video ./videos --color-scheme both
```

1. Run story test with `--record-video --color-scheme both`
2. Review pass/fail results
3. Review generated videos (`videos/light/`, `videos/dark/`)
4. Describe changes needed
5. Modify code (styles, tokens, template)
6. Re-run test to generate new videos
7. Repeat until satisfied

### Chrome DevTools Workflow

1. Start dev server: `bun --hot plaited dev src/`
2. Get story URL from stdout or via query scripts
3. Navigate with Chrome DevTools MCP
4. Take screenshot for visual context
5. Describe changes
6. Modify code
7. Hot reload refreshes browser
8. Take new screenshot
9. Repeat until satisfied

**Chrome DevTools MCP Examples:**

```typescript
// Navigate to story
mcp__chrome-devtools__navigate_page({ url: storyUrl })

// Take screenshot
mcp__chrome-devtools__take_screenshot({ filename: 'preview.png' })

// Get accessibility tree snapshot
mcp__chrome-devtools__take_snapshot({})
```

## Workshop CLI

The workshop CLI provides direct test execution:

```bash
# Discover and run all stories in paths
bun plaited test src/main

# Start dev server for manual testing
bun plaited dev
```

## Related Skills

- **plaited-framework-patterns** - Plaited framework patterns and examples
- **design-tokens-library** - Token patterns
- **typescript-lsp** - Type verification and code navigation
- **code-documentation** - TSDoc standards

## File Locations

**Workshop utilities:**
- `plaited/workshop/collect-stories.ts` - Story discovery
- `plaited/workshop/collect-behavioral-templates.ts` - Element discovery
- `plaited/workshop/get-paths.ts` - URL generation
- `plaited/workshop/cli.ts` - Workshop CLI

**Type definitions:**
- `plaited/workshop/workshop.types.ts` - StoryMetadata, TemplateExport
- `plaited/testing/testing.types.ts` - StoryExport, Play function types
