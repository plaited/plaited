# Web API Patterns for Plaited

This directory contains modern HTML and Web API patterns optimized for Plaited's behavioral programming framework.

## Categories

### web-apis/
Modern Web APIs that work well with Plaited's Shadow DOM and behavioral programming:
- Intersection Observer
- Mutation Observer
- Web Workers integration
- Priority Hints
- etc.

### performance/
Performance optimization patterns using native HTML:
- Resource hints (preconnect, dns-prefetch, prefetch)
- Loading strategies (defer, async, fetchpriority)
- Code splitting patterns
- etc.

### accessibility/
Accessibility patterns using modern HTML:
- ARIA best practices
- Semantic HTML
- Keyboard navigation
- Screen reader optimization
- etc.

### html-features/
Modern HTML features:
- Dialog element
- Popover API
- Invokers API
- Details/Summary
- etc.

## Adding New Patterns

Use the local `/extract-web-pattern` command to extract patterns from articles, or manually create files following this template:

```markdown
# [Pattern Name]

## Use Case
[When and why to use this]

## Implementation
\`\`\`typescript
// Plaited example
\`\`\`

## Plaited Integration
- Shadow DOM compatible: yes/no
- Behavioral programming usage: [how it fits]
- Signal patterns: [if applicable]

## Benefits
- Performance: [specific improvements]
- Accessibility: [a11y improvements]

## Browser Support
[Compatibility notes]

## References
- [Source URL]
```
