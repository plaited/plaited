---
name: code-query
description: Discover and query Plaited codebase structure using workshop tools. Find stories, behavioral elements, and generate preview URLs. Automatically invoked when exploring the codebase for patterns, examples, or testing artifacts.
allowed-tools: Bash
---

# Code Query Skill

## Purpose

Discover and query Plaited codebase structure. Use this when:
- Discovering all stories (*.stories.tsx files) in the codebase
- Finding behavioral element exports (bElement definitions)
- Generating preview URLs for stories
- Understanding codebase structure and patterns
- Planning test execution strategies

## Scripts

### Individual Scripts

#### query-stories
Discover all stories in specified paths.

```bash
bun .claude/skills/code-query/scripts/query-stories.ts <paths...>
```

**Example:**
```bash
bun .claude/skills/code-query/scripts/query-stories.ts src/main
bun .claude/skills/code-query/scripts/query-stories.ts src/components src/features
```

#### query-templates
Discover all bElement exports in specified paths.

```bash
bun .claude/skills/code-query/scripts/query-templates.ts <paths...>
```

**Example:**
```bash
bun .claude/skills/code-query/scripts/query-templates.ts src/main
```

#### query-story-url
Generate preview URLs for a story.

```bash
bun .claude/skills/code-query/scripts/query-story-url.ts <file> <exportName> [--port <port>]
```

**Example:**
```bash
bun .claude/skills/code-query/scripts/query-story-url.ts src/button.stories.tsx PrimaryButton
bun .claude/skills/code-query/scripts/query-story-url.ts src/button.stories.tsx PrimaryButton --port 3500
```

#### query-paths
Get route and entry path for a story export.

```bash
bun .claude/skills/code-query/scripts/query-paths.ts <file> <exportName>
```

**Example:**
```bash
bun .claude/skills/code-query/scripts/query-paths.ts src/button.stories.tsx PrimaryButton
```

### Batch Script

#### query-analyze
Batch analysis for discovering stories, templates, and generating URLs.

```bash
bun .claude/skills/code-query/scripts/query-analyze.ts <paths...> [options]
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
bun .claude/skills/code-query/scripts/query-analyze.ts src/main --all

# Just stories with URLs
bun .claude/skills/code-query/scripts/query-analyze.ts src/main --stories --urls

# Just templates
bun .claude/skills/code-query/scripts/query-analyze.ts src/components --templates
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
- **typescript-lsp** - Type verification and code navigation
- **code-documentation** - TSDoc standards

## File Locations

**Workshop utilities:**
- `src/workshop/collect-stories.ts` - Story discovery
- `src/workshop/collect-behavioral-templates.ts` - Element discovery
- `src/workshop/get-paths.ts` - URL generation
- `src/workshop/cli.ts` - Workshop CLI

**Type definitions:**
- `src/workshop/workshop.types.ts` - StoryMetadata, TemplateExport
- `src/testing/testing.types.ts` - StoryExport, Play function types
