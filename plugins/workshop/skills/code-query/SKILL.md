---
name: code-query
description: Discover and query Plaited codebase structure using workshop tools. Find stories, behavioral elements, and generate preview URLs. Automatically invoked when exploring the codebase for patterns, examples, or testing artifacts.
---

# Code Query Skill

## Purpose

This skill enables systematic discovery and querying of Plaited codebase structure using the workshop's built-in discovery tools. Use this when:
- Discovering all stories (*.stories.tsx files) in the codebase
- Finding behavioral element exports (bElement definitions)
- Generating preview URLs for stories
- Understanding codebase structure and patterns
- Locating examples for specific Plaited patterns
- Planning test execution strategies

## Core Capabilities

### Story Discovery

Discover all story files and their metadata in specified paths:

```typescript
import { collectStories } from 'plaited/workshop'

// Discover stories in one or more paths
const stories = await collectStories(cwd, paths)

// Returns Map<string, StoryMetadata> with:
// - route: URL path for story preview
// - exportName: Story export name
// - filePath: Absolute path to story file
// - entryPath: Bundle entry path
// - hasPlay: Whether story has play function
// - flag: 'only' | 'skip' | undefined
```

**When to use:**
- Finding all stories in a directory tree
- Planning test execution (respects .only() and .skip())
- Understanding what stories exist for a feature
- Generating test coverage reports

### Behavioral Element Discovery

Discover all bElement exports in the codebase:

```typescript
import { discoverBehavioralTemplateMetadata } from 'plaited/workshop'

// Discover all bElement exports
const elements = await discoverBehavioralTemplateMetadata(cwd)

// Returns TemplateExport[] with:
// - exportName: Name of the bElement export
// - filePath: Absolute path to file
// - type: 'BehavioralTemplate'
```

**When to use:**
- Finding all custom elements in the codebase
- Understanding islands architecture structure
- Locating behavioral element examples
- Planning integration tests

### Story URL Generation

Generate preview URLs for stories in the workshop dev server:

```typescript
import { getStoryUrl } from 'plaited/workshop'

const { url, templateUrl } = getStoryUrl({
  cwd: '/project/root',
  filePath: '/project/root/src/button.stories.tsx',
  exportName: 'PrimaryButton',
  port: 3000 // Optional, defaults to 3000
})

// url: 'http://localhost:3000/src/button--primary-button'
// templateUrl: 'http://localhost:3000/src/button--primary-button.template'
```

**When to use:**
- Generating links to story previews
- Testing stories in browser
- Visual debugging with template-only mode
- Sharing story examples

## Workshop CLI Integration

The workshop CLI (`src/workshop/cli.ts`) uses these tools for test execution:

```bash
# Discover and run all stories in paths
bun plaited test src/main

# Start dev server for manual testing
bun plaited dev
```

**CLI Workflow:**
1. Uses `collectStories()` to discover stories in provided paths
2. Applies .only() and .skip() filtering per-file
3. Starts dev server with discovered stories
4. Executes play functions with Playwright

## Discovery Patterns

### Find Stories by Path

```typescript
// Single directory
const stories = await collectStories(cwd, ['src/components'])

// Multiple paths
const stories = await collectStories(cwd, [
  'src/components',
  'src/features',
  'src/pages'
])

// Single file
const stories = await collectStories(cwd, ['src/button.stories.tsx'])
```

### Find Stories with Specific Flags

```typescript
const stories = await collectStories(cwd, paths)

// Get only .only() stories
const onlyStories = Array.from(stories.values()).filter(s => s.flag === 'only')

// Get stories with play functions
const interactiveStories = Array.from(stories.values()).filter(s => s.hasPlay)
```

### Find Behavioral Elements

```typescript
// Find all bElements
const elements = await discoverBehavioralTemplateMetadata(cwd)

// Group by directory
const byDir = elements.reduce((acc, el) => {
  const dir = dirname(el.filePath)
  if (!acc[dir]) acc[dir] = []
  acc[dir].push(el)
  return acc
}, {} as Record<string, typeof elements>)
```

## Performance Characteristics

**Runtime-based discovery** (~30x faster than TypeScript compilation):
- `collectStories()`: ~50ms for typical project
- `discoverBehavioralTemplateMetadata()`: ~50ms for typical project

**Trade-offs:**
- ✅ Fast and simple
- ✅ Works with any valid TypeScript/TSX
- ❌ Requires files to be executable
- ❌ Errors in files will cause discovery to fail

## Common Queries

### "Find all stories for a feature"

```typescript
const stories = await collectStories(cwd, ['src/features/auth'])
console.log(`Found ${stories.size} stories in auth feature`)
```

### "Find all custom form controls"

```typescript
const elements = await discoverBehavioralTemplateMetadata(cwd)
const formElements = elements.filter(el =>
  el.filePath.includes('form') || el.exportName.toLowerCase().includes('input')
)
```

### "Generate URLs for all stories"

```typescript
const stories = await collectStories(cwd, paths)
const urls = Array.from(stories.values()).map(story => ({
  name: story.exportName,
  ...getStoryUrl({
    cwd,
    filePath: story.filePath,
    exportName: story.exportName
  })
}))
```

### "Find stories without play functions"

```typescript
const stories = await collectStories(cwd, paths)
const snapshotStories = Array.from(stories.values()).filter(s => !s.hasPlay)
console.log(`Found ${snapshotStories.length} snapshot-only stories`)
```

## Best Practices

### Always Use Absolute Paths

```typescript
// ✅ Good - use absolute cwd
const cwd = process.cwd()
const stories = await collectStories(cwd, ['src/'])

// ❌ Bad - relative paths may fail
const stories = await collectStories('./project', ['src/'])
```

### Handle Discovery Errors

```typescript
try {
  const stories = await collectStories(cwd, paths)
} catch (error) {
  console.error('Discovery failed:', error)
  // Stories may have import errors or invalid exports
}
```

### Use Type Inference

```typescript
import type { StoryMetadata, TemplateExport } from 'plaited/workshop'

// Type-safe story processing
function processStory(story: StoryMetadata) {
  if (story.hasPlay) {
    // This is an interactive story
  }
}
```

## Related Skills

- **plaited-patterns** - Understanding Plaited framework patterns and examples
- **code-documentation** - Writing TSDoc for workshop utilities

## File Locations

**Workshop utilities:**
- `src/workshop/collect-stories.ts` - Story discovery implementation
- `src/workshop/collect-behavioral-templates.ts` - Element discovery implementation
- `src/workshop/get-paths.ts` - URL generation implementation
- `src/workshop/cli.ts` - Workshop CLI using these tools

**Type definitions:**
- `src/workshop/workshop.types.ts` - StoryMetadata, TemplateExport types
- `src/testing/testing.types.ts` - StoryExport, Play function types
