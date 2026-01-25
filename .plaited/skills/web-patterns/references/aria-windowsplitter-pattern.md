# ARIA Window Splitter Pattern

## Overview

A window splitter is a moveable separator between two sections, or panes, of a window that enables users to change the relative size of the panes. A Window Splitter can be either variable or fixed. A fixed splitter toggles between two positions whereas a variable splitter can be adjusted to any position within an allowed range.

**Key Characteristics:**
- **Resizable panes**: Controls the relative size of two panes (primary and secondary)
- **Value-based**: Has a value representing the size of the primary pane (0-100)
- **Orientation**: Can be vertical (left/right panes) or horizontal (top/bottom panes)
- **Modes**: Variable (adjustable to any position) or fixed (toggles between two positions)
- **Collapsible**: Primary pane can be collapsed/expanded
- **Keyboard accessible**: Arrow keys move the splitter, Enter toggles collapse

**Important Notes:**
- The splitter value represents the size of the **primary pane**
- When value is minimum (0), primary pane is smallest, secondary pane is largest
- When value is maximum (100), primary pane is largest, secondary pane is smallest
- The splitter's accessible name should match the primary pane's name
- Fixed splitters omit arrow key implementation (only toggle with Enter)
- The term "primary pane" does not describe importance, just which pane the value represents

## Use Cases

- Code editor with file explorer sidebar
- Book reader with table of contents panel
- Dashboard with resizable panels
- Email client with folder list and message view
- Image editor with tool panels
- Documentation viewer with navigation sidebar
- IDE with multiple resizable panels
- Split view file manager

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Vertical Splitter -->
<div class="split-container">
  <div id="primary-pane" class="pane">Primary Content</div>
  <div
    role="separator"
    aria-valuenow="50"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label="Primary Pane"
    aria-controls="primary-pane"
    tabindex="0"
    class="splitter"
  ></div>
  <div class="pane">Secondary Content</div>
</div>
```

```javascript
// Window Splitter implementation
const splitter = document.querySelector('[role="separator"]')
const container = splitter.closest('.split-container')
const primaryPane = document.getElementById('primary-pane')
let currentValue = 50
let previousValue = 50
let isCollapsed = false

function updateSplitter(value) {
  currentValue = Math.max(0, Math.min(100, value))
  splitter.setAttribute('aria-valuenow', String(currentValue))
  primaryPane.style.width = `${currentValue}%`
}

function collapsePane() {
  if (isCollapsed) {
    updateSplitter(previousValue)
    isCollapsed = false
  } else {
    previousValue = currentValue
    updateSplitter(0)
    isCollapsed = true
  }
}

splitter.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      updateSplitter(currentValue - 5)
      break
    case 'ArrowRight':
      e.preventDefault()
      updateSplitter(currentValue + 5)
      break
    case 'Enter':
      e.preventDefault()
      collapsePane()
      break
    case 'Home':
      e.preventDefault()
      updateSplitter(0)
      break
    case 'End':
      e.preventDefault()
      updateSplitter(100)
      break
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, window splitters are implemented as **bElements** because they require complex state management (value, dragging, collapse state, mouse/keyboard interactions).

**File Structure:**

```
splitter/
  splitter.css.ts        # Styles (createStyles) - ALWAYS separate
  splitter.stories.tsx   # bElement + stories (imports from css.ts)
```

#### splitter.css.ts

```typescript
// splitter.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'flex',
  inlineSize: '100%',
  blockSize: '100%',
})

export const styles = createStyles({
  container: {
    display: 'flex',
    inlineSize: '100%',
    blockSize: '100%',
    position: 'relative',
  },
  containerVertical: {
    flexDirection: 'column',
  },
  primaryPane: {
    overflow: 'auto',
    transition: 'width 0.2s ease, height 0.2s ease',
  },
  secondaryPane: {
    flex: 1,
    overflow: 'auto',
    minInlineSize: 0,
    minBlockSize: 0,
  },
  splitter: {
    position: 'relative',
    backgroundColor: '#e0e0e0',
    cursor: 'col-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    flexShrink: 0,
    inlineSize: '4px',
    minInlineSize: '4px',
  },
  splitterVertical: {
    cursor: 'row-resize',
    blockSize: '4px',
    minBlockSize: '4px',
    inlineSize: '100%',
  },
  splitterFocused: {
    outline: '2px solid #007bff',
    outlineOffset: '-2px',
  },
})
```

#### splitter.stories.tsx

```typescript
// splitter.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './splitter.css.ts'

// Types - defined locally
type SplitterEvents = {
  change: { value: number; collapsed: boolean }
  input: { value: number }
}

// bElement for window splitter - defined locally, NOT exported
const WindowSplitter = bElement<SplitterEvents>({
  tag: 'pattern-window-splitter',
  observedAttributes: ['value', 'min', 'max', 'aria-label', 'aria-orientation', 'step'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div p-target='container' {...styles.container}>
      <div p-target='primary-pane' {...styles.primaryPane}>
        <slot name='primary'></slot>
      </div>
      <div
        p-target='splitter'
        role='separator'
        tabIndex={0}
        {...styles.splitter}
        p-trigger={{ keydown: 'handleKeydown', mousedown: 'handleMouseDown', focus: 'handleFocus', blur: 'handleBlur' }}
      ></div>
      <div p-target='secondary-pane' {...styles.secondaryPane}>
        <slot name='secondary'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const container = $('container')[0]
    const primaryPane = $('primary-pane')[0]
    const secondaryPane = $('secondary-pane')[0]
    const splitter = $('splitter')[0]

    let currentValue = 50
    let min = 0
    let max = 100
    let step = 5
    let isDragging = false
    let previousValue = 50
    let isCollapsed = false
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'

    const updateSplitter = (value: number, emitEvent = true) => {
      const clampedValue = Math.max(min, Math.min(max, value))
      currentValue = clampedValue

      splitter?.attr('aria-valuenow', String(currentValue))
      splitter?.attr('aria-valuemin', String(min))
      splitter?.attr('aria-valuemax', String(max))

      if (primaryPane && secondaryPane) {
        if (isVertical) {
          primaryPane.style.height = `${currentValue}%`
          primaryPane.style.width = '100%'
        } else {
          primaryPane.style.width = `${currentValue}%`
          primaryPane.style.height = '100%'
        }
      }

      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))

      if (emitEvent) {
        emit({
          type: 'change',
          detail: { value: currentValue, collapsed: isCollapsed },
        })
      }
    }

    const collapsePane = () => {
      if (isCollapsed) {
        updateSplitter(previousValue)
        isCollapsed = false
      } else {
        previousValue = currentValue
        updateSplitter(min)
        isCollapsed = true
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !container) return

      const containerRect = container.getBoundingClientRect()
      let newValue: number

      if (isVertical) {
        const y = event.clientY - containerRect.top
        newValue = (y / containerRect.height) * 100
      } else {
        const x = event.clientX - containerRect.left
        newValue = (x / containerRect.width) * 100
      }

      updateSplitter(newValue)
    }

    const handleMouseUp = () => {
      isDragging = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowLeft':
            if (!isVertical) {
              event.preventDefault()
              updateSplitter(currentValue - step)
            }
            break

          case 'ArrowRight':
            if (!isVertical) {
              event.preventDefault()
              updateSplitter(currentValue + step)
            }
            break

          case 'ArrowUp':
            if (isVertical) {
              event.preventDefault()
              updateSplitter(currentValue - step)
            }
            break

          case 'ArrowDown':
            if (isVertical) {
              event.preventDefault()
              updateSplitter(currentValue + step)
            }
            break

          case 'Enter':
            event.preventDefault()
            collapsePane()
            break

          case 'Home':
            event.preventDefault()
            updateSplitter(min)
            break

          case 'End':
            event.preventDefault()
            updateSplitter(max)
            break
        }
      },

      handleMouseDown(event: MouseEvent) {
        isDragging = true
        event.preventDefault()

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },

      handleFocus() {
        splitter?.attr('class', `${styles.splitter.classNames.join(' ')} ${styles.splitterFocused.classNames.join(' ')}`)
      },

      handleBlur() {
        splitter?.attr('class', styles.splitter.classNames.join(' '))
      },

      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')
        const orientation = host.getAttribute('aria-orientation')

        if (minAttr) min = Number(minAttr) || 0
        if (maxAttr) max = Number(maxAttr) || 100
        if (stepAttr) step = Number(stepAttr) || 5

        if (valueAttr) {
          updateSplitter(Number(valueAttr), false)
        } else {
          updateSplitter(50, false)
        }

        if (ariaLabel) {
          splitter?.attr('aria-label', ariaLabel)
        }

        if (orientation === 'vertical') {
          splitter?.attr('aria-orientation', 'vertical')
          splitter?.attr('class', `${styles.splitter.classNames.join(' ')} ${styles.splitterVertical.classNames.join(' ')}`)
          container?.attr('class', `${styles.container.classNames.join(' ')} ${styles.containerVertical.classNames.join(' ')}`)
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateSplitter(Number(newValue))
        } else if (name === 'min' && newValue) {
          min = Number(newValue) || 0
          updateSplitter(currentValue)
        } else if (name === 'max' && newValue) {
          max = Number(newValue) || 100
          updateSplitter(currentValue)
        } else if (name === 'step' && newValue) {
          step = Number(newValue) || 5
        } else if (name === 'aria-label') {
          splitter?.attr('aria-label', newValue || '')
        }
      },

      onDisconnected() {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const codeEditorSplitter = story({
  intent: 'Code editor with resizable file explorer sidebar',
  template: () => (
    <WindowSplitter value='25' min='10' max='80' step='5' aria-label='File Explorer'>
      <div slot='primary' style='padding: 1rem; background: #f0f0f0;'>
        <h3>File Explorer</h3>
        <ul>
          <li>src/</li>
          <li>public/</li>
          <li>package.json</li>
        </ul>
      </div>
      <div slot='secondary' style='padding: 1rem;'>
        <h3>Code Editor</h3>
        <pre>function hello() {'{}'}</pre>
      </div>
    </WindowSplitter>
  ),
  play: async ({ findByAttribute, assert }) => {
    const splitter = await findByAttribute('role', 'separator')

    assert({
      given: 'splitter is rendered',
      should: 'have initial value',
      actual: splitter?.getAttribute('aria-valuenow'),
      expected: '25',
    })
  },
})

export const verticalSplitter = story({
  intent: 'Vertical splitter with top/bottom panes',
  template: () => (
    <WindowSplitter value='50' aria-label='Top Panel' aria-orientation='vertical'>
      <div slot='primary' style='padding: 1rem; background: #e0e0e0;'>
        Top Panel Content
      </div>
      <div slot='secondary' style='padding: 1rem;'>
        Bottom Panel Content
      </div>
    </WindowSplitter>
  ),
  play: async ({ findByAttribute, assert }) => {
    const splitter = await findByAttribute('role', 'separator')

    assert({
      given: 'vertical splitter',
      should: 'have vertical orientation',
      actual: splitter?.getAttribute('aria-orientation'),
      expected: 'vertical',
    })
  },
})

export const splitterAccessibility = story({
  intent: 'Verify splitter accessibility structure',
  template: () => (
    <WindowSplitter value='50' aria-label='Test Splitter'>
      <div slot='primary'>Primary</div>
      <div slot='secondary'>Secondary</div>
    </WindowSplitter>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - splitters can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No - uses standard DOM APIs (mouse events)
- **Cleanup required**: Yes - mouse event listeners must be cleaned up in `onDisconnected`

## Keyboard Interaction

### Variable Splitter

- **Left Arrow** (horizontal): Moves splitter left (decreases primary pane size)
- **Right Arrow** (horizontal): Moves splitter right (increases primary pane size)
- **Up Arrow** (vertical): Moves splitter up (decreases primary pane size)
- **Down Arrow** (vertical): Moves splitter down (increases primary pane size)
- **Enter**: Collapses primary pane if not collapsed, or restores to previous position
- **Home** (Optional): Moves splitter to minimum position
- **End** (Optional): Moves splitter to maximum position

### Fixed Splitter

- **Enter**: Toggles between two positions (collapsed/expanded)
- **Arrow keys**: Not implemented for fixed splitters

## WAI-ARIA Roles, States, and Properties

### Required

- **role="separator"**: The element that serves as the focusable splitter
- **aria-valuenow**: Decimal value representing current position (0-100)
- **aria-valuemin**: Decimal value for minimum position (typically 0)
- **aria-valuemax**: Decimal value for maximum position (typically 100)

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for splitter (should match primary pane name)
- **aria-controls**: References the primary pane element
- **aria-orientation**: `vertical` for horizontal splitter (top/bottom panes)

## Best Practices

1. **Use bElement** - Splitters require complex state coordination
2. **Use spread syntax** - `{...styles.x}` for applying styles
3. **Accessible name** - Splitter label should match primary pane name
4. **Value range** - Use 0-100 for percentage-based sizing
5. **Step size** - Provide reasonable step size for keyboard navigation
6. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce splitter value and position
- Keyboard navigation enables efficient splitter adjustment
- Collapse/expand functionality improves usability
- Proper ARIA attributes communicate state and purpose

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
- MDN: [ARIA separator role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/separator_role)
- Related: [Slider Pattern](./aria-slider-pattern.md) - Similar value-based interaction
