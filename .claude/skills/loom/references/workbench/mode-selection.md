# Design Iteration Modes

How to get visual feedback during design iteration.

## Test Video Mode

The primary mode for design iteration uses the workshop CLI with Playwright:

```bash
bun plaited test src/button.stories.tsx --record-video ./videos --color-scheme both
```

### Capabilities

| Feature | Description |
|---------|-------------|
| **Pass/fail feedback** | Story tests with assertions |
| **Video recording** | Capture interaction sequences |
| **Color schemes** | Test both light and dark in one run |
| **Accessibility** | Via play function assertions |
| **Screenshots** | Captured on test failure |

### When to Use

- Story has a `play` function with interactions
- Need to verify interaction behavior
- Want videos for both light and dark modes
- Need pass/fail feedback from tests

### Workflow

1. **Start dev server** (optional, CLI can auto-start):
   ```bash
   bun --hot plaited dev src/templates
   ```

2. **Run tests with video recording**:
   ```bash
   bun plaited test src/button.stories.tsx --record-video ./videos
   ```

3. **Review videos** for visual feedback

4. **Iterate** on styles/templates and re-run

## Future: Programmatic Browser Automation

The `src/agent/` module is being developed to provide programmatic browser automation via Playwright/Puppeteer for real-time design iteration without requiring test runs.
