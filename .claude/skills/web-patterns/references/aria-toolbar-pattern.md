# ARIA Toolbar Pattern

## Overview

A toolbar is a container for grouping a set of controls, such as buttons, menubuttons, or checkboxes. When a set of controls is visually presented as a group, the `toolbar` role can be used to communicate the presence and purpose of the grouping to screen reader users. Grouping controls into toolbars can also be an effective way of reducing the number of tab stops in the keyboard interface.

**Key Characteristics:**
- **Container for controls**: Groups buttons, menubuttons, checkboxes, and other interactive controls
- **Roving tabindex**: Single tab stop for the toolbar, arrow keys navigate within
- **Focus management**: Tab enters/exits toolbar, arrows move focus among controls
- **Orientation**: Horizontal (default) or vertical
- **Minimum controls**: Should contain 3 or more controls to be effective

**Important Notes:**
- Toolbar reduces tab stops by using roving tabindex (only one control is in tab sequence)
- Arrow keys navigate between controls within the toolbar
- Disabled controls are typically not focusable, but may be focusable for discoverability

## Use Cases

- Text editor toolbars (formatting, alignment, styles)
- Image editor toolbars (tools, filters, adjustments)
- Form builder toolbars (add fields, configure options)
- Dashboard control panels (filters, views, actions)
- Drawing/design toolbars (shapes, colors, tools)
- Media player controls (play, pause, volume, settings)
- Document editor toolbars (bold, italic, lists, links)

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Horizontal Toolbar -->
<div role="toolbar" aria-label="Text Formatting">
  <button type="button" aria-pressed="false" tabindex="0">Bold</button>
  <button type="button" aria-pressed="false" tabindex="-1">Italic</button>
  <button type="button" aria-pressed="false" tabindex="-1">Underline</button>
  <button type="button" tabindex="-1">Link</button>
  <button type="button" tabindex="-1">Image</button>
</div>
```

```javascript
// Toolbar with roving tabindex
const toolbar = document.querySelector('[role="toolbar"]')
const controls = Array.from(toolbar.querySelectorAll('button'))
let focusedIndex = 0

function updateTabindex(index) {
  controls.forEach((control, i) => {
    control.setAttribute('tabindex', i === index ? '0' : '-1')
  })
}

function moveFocus(direction) {
  switch (direction) {
    case 'next':
      focusedIndex = (focusedIndex + 1) % controls.length
      break
    case 'prev':
      focusedIndex = (focusedIndex - 1 + controls.length) % controls.length
      break
    case 'first':
      focusedIndex = 0
      break
    case 'last':
      focusedIndex = controls.length - 1
      break
  }

  updateTabindex(focusedIndex)
  controls[focusedIndex].focus()
}

toolbar.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      moveFocus('next')
      break
    case 'ArrowLeft':
      e.preventDefault()
      moveFocus('prev')
      break
    case 'Home':
      e.preventDefault()
      moveFocus('first')
      break
    case 'End':
      e.preventDefault()
      moveFocus('last')
      break
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, toolbars are implemented as **bElements** because they require complex state management (roving tabindex, focus tracking, keyboard navigation).

**File Structure:**

```
toolbar/
  toolbar.css.ts        # Styles (createStyles) - ALWAYS separate
  toolbar.stories.tsx   # bElement + stories (imports from css.ts)
```

#### toolbar.css.ts

```typescript
// toolbar.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  toolbar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#f5f5f5',
  },
  toolbarVertical: {
    flexDirection: 'column',
  },
  button: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  buttonPressed: {
    backgroundColor: '#007bff',
    color: '#fff',
    borderColor: '#007bff',
  },
  buttonFocused: {
    outline: '2px solid #0056b3',
    outlineOffset: '2px',
  },
})
```

#### toolbar.stories.tsx

```typescript
// toolbar.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './toolbar.css.ts'

// Types - defined locally
type ToolbarEvents = {
  controlActivate: { control: HTMLElement; index: number }
}

// bElement for toolbar - defined locally, NOT exported
const Toolbar = bElement<ToolbarEvents>({
  tag: 'pattern-toolbar',
  observedAttributes: ['aria-label', 'aria-orientation'],
  hostStyles,
  shadowDom: (
    <div
      p-target='toolbar'
      role='toolbar'
      {...styles.toolbar}
      p-trigger={{ keydown: 'handleKeydown', focusin: 'handleFocusIn' }}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const toolbar = $('toolbar')[0]
    let controls: HTMLElement[] = []
    let focusedIndex = 0
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'

    const getControls = (): HTMLElement[] => {
      const slot = toolbar?.querySelector('slot') as HTMLSlotElement
      if (!slot) return []

      const assignedNodes = slot.assignedNodes()
      const elements: HTMLElement[] = []

      assignedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement
          if (
            element.tagName === 'BUTTON' ||
            element.getAttribute('role') === 'button' ||
            element.getAttribute('role') === 'checkbox'
          ) {
            elements.push(element)
          }
        }
      })

      return elements
    }

    const getFocusableControls = (): HTMLElement[] => {
      return controls.filter((control) => {
        const disabled =
          control.hasAttribute('disabled') ||
          control.getAttribute('aria-disabled') === 'true'
        return !disabled
      })
    }

    const updateTabindex = (index: number) => {
      const focusableControls = getFocusableControls()
      focusableControls.forEach((control, i) => {
        control.setAttribute('tabindex', i === index ? '0' : '-1')
      })
    }

    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      const focusableControls = getFocusableControls()
      if (focusableControls.length === 0) return

      switch (direction) {
        case 'next':
          focusedIndex = (focusedIndex + 1) % focusableControls.length
          break
        case 'prev':
          focusedIndex = (focusedIndex - 1 + focusableControls.length) % focusableControls.length
          break
        case 'first':
          focusedIndex = 0
          break
        case 'last':
          focusedIndex = focusableControls.length - 1
          break
      }

      updateTabindex(focusedIndex)
      focusableControls[focusedIndex].focus()
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        const horizontal = !isVertical

        switch (event.key) {
          case 'ArrowRight':
            if (horizontal) {
              event.preventDefault()
              moveFocus('next')
            }
            break
          case 'ArrowLeft':
            if (horizontal) {
              event.preventDefault()
              moveFocus('prev')
            }
            break
          case 'ArrowDown':
            if (!horizontal) {
              event.preventDefault()
              moveFocus('next')
            }
            break
          case 'ArrowUp':
            if (!horizontal) {
              event.preventDefault()
              moveFocus('prev')
            }
            break
          case 'Home':
            event.preventDefault()
            moveFocus('first')
            break
          case 'End':
            event.preventDefault()
            moveFocus('last')
            break
        }
      },

      handleFocusIn(event: FocusEvent) {
        const target = event.target as HTMLElement
        if (!target) return

        controls = getControls()
        const focusableControls = getFocusableControls()

        if (focusableControls.includes(target)) {
          focusedIndex = focusableControls.indexOf(target)
          updateTabindex(focusedIndex)
        }
      },

      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')

        if (ariaLabel) {
          toolbar?.setAttribute('aria-label', ariaLabel)
        }

        if (isVertical) {
          toolbar?.setAttribute('aria-orientation', 'vertical')
          toolbar?.setAttribute(
            'class',
            `${styles.toolbar.classNames.join(' ')} ${styles.toolbarVertical.classNames.join(' ')}`
          )
        }

        setTimeout(() => {
          controls = getControls()
          const focusableControls = getFocusableControls()
          if (focusableControls.length > 0) {
            focusedIndex = 0
            updateTabindex(0)

            focusableControls.forEach((control) => {
              control.setAttribute('class', styles.button.classNames.join(' '))
            })
          }
        }, 0)
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-label') {
          toolbar?.setAttribute('aria-label', newValue || '')
        } else if (name === 'aria-orientation') {
          const isVerticalNow = newValue === 'vertical'
          if (isVerticalNow) {
            toolbar?.setAttribute('aria-orientation', 'vertical')
            toolbar?.setAttribute(
              'class',
              `${styles.toolbar.classNames.join(' ')} ${styles.toolbarVertical.classNames.join(' ')}`
            )
          } else {
            toolbar?.removeAttribute('aria-orientation')
            toolbar?.setAttribute('class', styles.toolbar.classNames.join(' '))
          }
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const textFormattingToolbar = story({
  intent: 'Text editor toolbar with formatting controls',
  template: () => (
    <Toolbar aria-label='Text Formatting'>
      <button type='button' aria-pressed='false'>
        Bold
      </button>
      <button type='button' aria-pressed='false'>
        Italic
      </button>
      <button type='button' aria-pressed='false'>
        Underline
      </button>
      <button type='button'>Link</button>
      <button type='button'>Image</button>
    </Toolbar>
  ),
  play: async ({ findByAttribute, assert }) => {
    const toolbar = await findByAttribute('role', 'toolbar')

    assert({
      given: 'toolbar is rendered',
      should: 'have accessible label',
      actual: toolbar?.getAttribute('aria-label'),
      expected: 'Text Formatting',
    })
  },
})

export const verticalToolbar = story({
  intent: 'Vertical toolbar with up/down arrow navigation',
  template: () => (
    <Toolbar aria-label='Drawing Tools' aria-orientation='vertical'>
      <button type='button'>Select</button>
      <button type='button'>Brush</button>
      <button type='button'>Eraser</button>
    </Toolbar>
  ),
  play: async ({ findByAttribute, assert }) => {
    const toolbar = await findByAttribute('role', 'toolbar')

    assert({
      given: 'vertical toolbar',
      should: 'have vertical orientation',
      actual: toolbar?.getAttribute('aria-orientation'),
      expected: 'vertical',
    })
  },
})

export const toolbarAccessibility = story({
  intent: 'Verify toolbar accessibility structure',
  template: () => (
    <Toolbar aria-label='Test Toolbar'>
      <button type='button'>Action 1</button>
      <button type='button'>Action 2</button>
      <button type='button'>Action 3</button>
    </Toolbar>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - toolbars can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Entering/Exiting Toolbar

- **Tab**: Moves focus into the toolbar (focuses first or last focused control)
- **Shift + Tab**: Moves focus out of the toolbar

### Horizontal Toolbar (default)

- **Left Arrow**: Moves focus to previous control (wraps to last)
- **Right Arrow**: Moves focus to next control (wraps to first)

### Vertical Toolbar

- **Up Arrow**: Moves focus to previous control (wraps to last)
- **Down Arrow**: Moves focus to next control (wraps to first)

### All Orientations

- **Home** (Optional): Moves focus to first control
- **End** (Optional): Moves focus to last control

## WAI-ARIA Roles, States, and Properties

### Required

- **role="toolbar"**: Container element for the toolbar

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for toolbar
- **aria-orientation**: `vertical` for vertical toolbars (default is `horizontal`)

## Best Practices

1. **Use bElement** - Toolbars require roving tabindex management
2. **Use spread syntax** - `{...styles.x}` for applying styles
3. **Minimum controls** - Use toolbar only if it contains 3 or more controls
4. **Roving tabindex** - Implement proper roving tabindex (single tab stop)
5. **Focus management** - Restore focus to last focused control when re-entering
6. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce toolbar and its purpose
- Roving tabindex reduces tab stops for keyboard users
- Arrow key navigation enables efficient control access
- Focus management ensures logical navigation flow

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- MDN: [ARIA toolbar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/toolbar_role)
- Related: [Menu Button Pattern](./aria-menubutton-pattern.md) - Can be used within toolbars
- Related: [Checkbox Pattern](./aria-checkbox-pattern.md) - Can be used within toolbars
