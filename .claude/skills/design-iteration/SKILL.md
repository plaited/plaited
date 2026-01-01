---
name: design-iteration
description: Multi-modal design refinement with visual feedback. Use when iterating on template designs with test videos, headless browser, or browser extension.
allowed-tools: Bash, Read, Edit, Write, Glob, mcp__playwright__*
---

# Design Iteration

Multi-modal design refinement with visual feedback.

## Purpose

This skill provides three modes for iterating on template designs:
1. **Test Video** - Run story tests with video recording
2. **Playwright** - Headless browser automation
3. **Browser Extension** - Use existing browser with extensions

## Quick Reference

| Mode | Use Case | Tool | Requirements |
|------|----------|------|--------------|
| Test Video | Interaction stories with play functions | `bun plaited test --record-video` | None |
| Playwright | Headless browser automation | `playwright` MCP | None |
| Browser Extension | Use existing browser with extensions | `playwright-extension` MCP | Browser extension bridge |

## References

### Mode Selection
- **[mode-selection.md](references/mode-selection.md)** - When to use each mode

### Test Video Mode
- **[test-video-mode.md](references/test-video-mode.md)** - CLI with `--record-video`
  - Pass/fail feedback from test results
  - Videos for light and dark color schemes
  - Best for stories with play functions

### Playwright Mode
- **[playwright-mode.md](references/playwright-mode.md)** - Headless browser
  - Screenshots and accessibility snapshots
  - Navigate and interact programmatically
  - Best for visual inspection

### Extension Mode
- **[extension-mode.md](references/extension-mode.md)** - Browser extension bridge
  - Use your existing browser
  - Access extensions and auth state
  - Requires setup (see reference)

## Iteration Workflow

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

### Playwright Workflow

1. Start dev server (via live-preview)
2. Navigate to story URL
3. Take screenshot for visual context
4. Describe changes
5. Modify code
6. Hot reload refreshes browser
7. Take new screenshot
8. Repeat until satisfied

### Browser Extension Workflow

Same as Playwright but uses your existing browser:
- Useful when testing with browser extensions
- Maintains auth state from your session
- Requires browser extension bridge setup

## Related Skills

- **live-preview** - Dev server and story URLs
- **code-query** - Story discovery
- **design-tokens-library** - Token patterns
- **plaited-framework-patterns** - Template patterns
