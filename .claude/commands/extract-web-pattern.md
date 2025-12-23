---
description: Extract Web API patterns from articles for plugin knowledge base
allowed-tools: mcp__playwright__browser_navigate, mcp__playwright__browser_evaluate, mcp__playwright__browser_screenshot, Write, Read
---

# Extract Web Pattern

Extract modern HTML/Web API patterns from the provided URL and add to the studio plugin knowledge base.

**Target URL:** $ARGUMENTS

## Instructions

1. Use Playwright MCP to navigate to the URL and extract the full article content
2. Identify patterns relevant to:
   - Modern HTML features (dialog, popover, invokers, etc.)
   - Web APIs (Intersection Observer, Priority Hints, etc.)
   - Performance optimization (preconnect, dns-prefetch, fetchpriority)
   - Accessibility improvements
   - Shadow DOM / Web Components compatible patterns

3. Extract:
   - **Pattern name**: Clear, descriptive title
   - **Use case**: When to use this pattern
   - **Implementation**: Code examples
   - **Plaited integration**: How it fits with behavioral programming, signals, or Web Components
   - **Benefits**: Performance, accessibility, or DX improvements
   - **Browser support**: Compatibility considerations

4. Format as markdown suitable for `plugins/studio/.claude/rules/patterns/web-apis/`

5. Save to appropriate location in studio plugin knowledge base

6. Ask user for confirmation before writing

## Example Output Format

```markdown
# [Pattern Name]

## Use Case
[When and why to use this]

## Implementation
\`\`\`typescript
// Plaited template example
const MyComponent = bElement({
  // Pattern integration here
})
\`\`\`

## Plaited Integration
- Works with Shadow DOM: [yes/no]
- Compatible with behavioral programming: [yes/no]
- Signal usage: [if applicable]

## Benefits
- Performance: [specific improvements]
- Accessibility: [a11y improvements]
- Browser support: [compatibility notes]

## References
- Source: [URL]
```
