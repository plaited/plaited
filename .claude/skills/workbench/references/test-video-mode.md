# Test Video Mode

Using the CLI with `--record-video` for design iteration.

## Overview

Test Video mode runs story tests and records videos of the interactions. This is ideal for stories with `play` functions that test user interactions.

## CLI Usage

```bash
# Basic usage
bun plaited test <paths...> --record-video <dir>

# With both color schemes
bun plaited test  src/button.stories.tsx --record-video ./videos --color-scheme both

# With custom video dimensions
bun plaited test src/button.stories.tsx --record-video ./videos --width 1920 --height 1080
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--record-video <dir>` | Directory for video recordings | - |
| `--color-scheme <mode>` | `light`, `dark`, or `both` | `light` |
| `--width <number>` | Video width in pixels | 1280 |
| `--height <number>` | Video height in pixels | 720 |

## Video Output

Videos are organized by color scheme:

```
videos/
  light/
    story-name-1.webm
    story-name-2.webm
  dark/
    story-name-1.webm
    story-name-2.webm
```

## Iteration Workflow

### Step 1: Run Initial Test

```bash
bun plaited test src/templates/toggle-input --record-video ./videos --color-scheme both
```

### Step 2: Review Results

- Check console for pass/fail status
- Review video files in `./videos/light/` and `./videos/dark/`
- Note any visual issues or failed assertions

### Step 3: Make Changes

Edit the relevant files:
- `*.tokens.ts` - Adjust colors, spacing
- `*.css.ts` - Modify styles
- `*.ts` - Change template structure
- `*.stories.tsx` - Update test assertions

### Step 4: Re-run Test

```bash
bun plaited test src/templates/toggle-input --record-video ./videos --color-scheme both
```

### Step 5: Compare Videos

Compare before/after videos to verify changes.

## Best Practices

1. **Use `--color-scheme both`** - Catch dark mode issues early
2. **Set appropriate dimensions** - Match target viewport
3. **Organize videos by iteration** - Use dated directories
4. **Review both pass and fail** - Failed tests show error state

## Example Session

```bash
# Initial test
$ bun plaited test src/toggle-input --record-video ./iteration-1 --color-scheme both

# Console shows:
# 🟢 basicToggle
# 🔴 toggleWithLabel (AssertionError: expected focused state)

# Fix the issue
$ edit src/toggle-input.css.ts

# Re-test
$ bun plaited test src/toggle-input --record-video ./iteration-2 --color-scheme both

# Console shows:
# 🟢 basicToggle
# 🟢 toggleWithLabel

# Compare videos
$ open ./iteration-1/light/ ./iteration-2/light/
```
