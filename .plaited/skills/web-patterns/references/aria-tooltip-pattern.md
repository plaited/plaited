# ARIA Tooltip Pattern

## Overview

A tooltip is a popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it. It typically appears after a small delay and disappears when Escape is pressed or on mouse out.

**Key Characteristics:**

- **Non-focusable**: Tooltips do not receive focus (unlike dialogs or popovers)
- **Triggered by hover/focus**: Appears on mouse hover or keyboard focus
- **Delayed appearance**: Typically appears after a small delay (e.g., 500ms)
- **Auto-dismiss**: Disappears on Escape, mouse out, or blur
- **Contextual information**: Provides additional information about the trigger element

**Important Notes:**

- Tooltips do NOT receive focus - focus stays on the triggering element
- If tooltip is invoked on focus, it's dismissed on blur
- If tooltip is invoked on hover, it remains open as long as cursor is over trigger or tooltip
- For tooltips containing focusable elements, use a non-modal dialog instead
- Native HTML `title` attribute provides basic tooltip functionality but has limitations
- Modern browsers support the Popover API which can be used for tooltips

**Differences from Popover/Dialog:**

- Tooltip: Non-focusable, appears on hover/focus, auto-dismisses
- Popover: Can be focusable, appears on click, may require explicit dismissal
- Dialog: Focusable, modal or non-modal, requires explicit interaction

## Use Cases

- Icon buttons that need labels
- Form field help text
- Abbreviation expansions
- Additional context for controls
- Short descriptions for complex UI elements
- Keyboard shortcut hints
- Status information
- Field validation messages

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Native HTML title attribute (simplest) -->
<button type="button" title="Save your changes">
  💾
</button>

<!-- ARIA Tooltip -->
<button
  type="button"
  id="save-button"
  aria-describedby="save-tooltip"
>
  💾
</button>
<div
  id="save-tooltip"
  role="tooltip"
  hidden
>
  Save your changes
</div>
```

```javascript
// ARIA Tooltip implementation
const trigger = document.getElementById('save-button')
const tooltip = document.getElementById('save-tooltip')
let showTimeout
let hideTimeout

function showTooltip() {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = undefined
  }

  if (showTimeout) return

  showTimeout = setTimeout(() => {
    tooltip.hidden = false
    showTimeout = undefined
  }, 500)
}

function hideTooltip() {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = undefined
  }

  hideTimeout = setTimeout(() => {
    tooltip.hidden = true
    hideTimeout = undefined
  }, 100)
}

trigger.addEventListener('mouseenter', showTooltip)
trigger.addEventListener('mouseleave', hideTooltip)
trigger.addEventListener('focus', showTooltip)
trigger.addEventListener('blur', hideTooltip)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !tooltip.hidden) {
    hideTooltip()
    trigger.focus()
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, tooltips can be implemented as:

1. **Native HTML `title` attribute** for simple cases (Functional Template)
2. **bElement** for ARIA tooltips with timing and positioning

**File Structure:**

```
tooltip/
  tooltip.css.ts        # Styles (createStyles) - ALWAYS separate
  tooltip.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### tooltip.css.ts

```typescript
// tooltip.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'inline-block',
  position: 'relative',
})

export const styles = createStyles({
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  tooltip: {
    position: 'absolute',
    insetBlockEnd: '100%',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    marginBlockEnd: '0.5rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  tooltipHidden: {
    opacity: 0,
    visibility: 'hidden',
  },
  tooltipVisible: {
    opacity: 1,
    visibility: 'visible',
  },
  arrow: {
    position: 'absolute',
    insetBlockStart: '100%',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    border: '6px solid transparent',
    borderBlockStartColor: '#333',
  },
})
```

#### tooltip.stories.tsx

```typescript
// tooltip.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './tooltip.css.ts'

// Types - defined locally
type TooltipEvents = {
  show: { trigger: HTMLElement }
  hide: { trigger: HTMLElement }
}

// FunctionalTemplate for simple tooltip - defined locally, NOT exported
const SimpleTooltipButton: FT<{
  title: string
  children?: Children
}> = ({ title, children, ...attrs }) => (
  <button type='button' title={title} {...attrs}>
    {children}
  </button>
)

// bElement for ARIA tooltip - defined locally, NOT exported
const Tooltip = bElement<TooltipEvents>({
  tag: 'pattern-tooltip',
  observedAttributes: ['delay'],
  hostStyles,
  shadowDom: (
    <div {...styles.container}>
      <slot
        name='trigger'
        p-trigger={{ mouseenter: 'handleMouseEnter', mouseleave: 'handleMouseLeave', focus: 'handleFocus', blur: 'handleBlur' }}
      ></slot>
      <div
        p-target='tooltip'
        role='tooltip'
        {...styles.tooltip}
        {...styles.tooltipHidden}
      >
        <slot name='content'></slot>
        <span {...styles.arrow}></span>
      </div>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const tooltip = $('tooltip')[0]
    let trigger: HTMLElement | null = null
    let showTimeout: ReturnType<typeof setTimeout> | undefined
    let hideTimeout: ReturnType<typeof setTimeout> | undefined
    let delay = 500

    const getTrigger = (): HTMLElement | null => {
      const slot = root.querySelector('slot[name="trigger"]') as HTMLSlotElement
      if (!slot) return null

      const assignedNodes = slot.assignedNodes()
      for (const node of assignedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return node as HTMLElement
        }
      }
      return null
    }

    const showTooltip = () => {
      if (!tooltip || !trigger) return

      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = undefined
      }

      if (showTimeout) return

      showTimeout = setTimeout(() => {
        if (!tooltip || !trigger) return

        const tooltipId = tooltip.id || `tooltip-${Math.random().toString(36).substr(2, 9)}`
        if (!tooltip.id) {
          tooltip.id = tooltipId
        }
        trigger.setAttribute('aria-describedby', tooltipId)

        tooltip.attr('class', `${styles.tooltip.classNames.join(' ')} ${styles.tooltipVisible.classNames.join(' ')}`)

        emit({ type: 'show', detail: { trigger } })

        showTimeout = undefined
      }, delay)
    }

    const hideTooltip = () => {
      if (!tooltip || !trigger) return

      if (showTimeout) {
        clearTimeout(showTimeout)
        showTimeout = undefined
      }

      if (hideTimeout) return

      hideTimeout = setTimeout(() => {
        if (!tooltip || !trigger) return

        tooltip.attr('class', `${styles.tooltip.classNames.join(' ')} ${styles.tooltipHidden.classNames.join(' ')}`)
        trigger.removeAttribute('aria-describedby')

        emit({ type: 'hide', detail: { trigger } })

        hideTimeout = undefined
      }, 100)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const tooltipClass = tooltip?.attr('class') || ''
        if (tooltipClass.includes(styles.tooltipVisible.classNames[0])) {
          hideTooltip()
          trigger?.focus()
        }
      }
    }

    return {
      handleMouseEnter() {
        showTooltip()
      },

      handleMouseLeave() {
        hideTooltip()
      },

      handleFocus() {
        showTooltip()
      },

      handleBlur() {
        hideTooltip()
      },

      onConnected() {
        trigger = getTrigger()
        if (!trigger) return

        const delayAttr = host.getAttribute('delay')
        if (delayAttr) {
          delay = Number(delayAttr) || 500
        }

        document.addEventListener('keydown', handleEscape)
      },

      onDisconnected() {
        if (showTimeout) {
          clearTimeout(showTimeout)
        }
        if (hideTimeout) {
          clearTimeout(hideTimeout)
        }

        document.removeEventListener('keydown', handleEscape)
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'delay') {
          delay = newValue ? Number(newValue) || 500 : 500
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const simpleTooltip = story({
  intent: 'Button with native title tooltip',
  template: () => (
    <SimpleTooltipButton title='Save your changes'>💾</SimpleTooltipButton>
  ),
  play: async ({ findByRole, assert }) => {
    const button = await findByRole('button')

    assert({
      given: 'button with title',
      should: 'have title attribute',
      actual: button?.getAttribute('title'),
      expected: 'Save your changes',
    })
  },
})

export const ariaTooltip = story({
  intent: 'Icon button with ARIA tooltip',
  template: () => (
    <Tooltip delay='500'>
      <button slot='trigger' type='button' aria-label='Save'>
        💾
      </button>
      <span slot='content'>Save your changes</span>
    </Tooltip>
  ),
  play: async ({ findByAttribute, assert }) => {
    const tooltip = await findByAttribute('role', 'tooltip')

    assert({
      given: 'tooltip is rendered',
      should: 'have tooltip role',
      actual: tooltip?.getAttribute('role'),
      expected: 'tooltip',
    })
  },
})

export const tooltipAccessibility = story({
  intent: 'Verify tooltip accessibility structure',
  template: () => (
    <Tooltip delay='300'>
      <button slot='trigger' type='button' aria-label='Help'>
        ?
      </button>
      <span slot='content'>Click for help</span>
    </Tooltip>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tooltips can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: Yes - timers and event listeners must be cleaned up in `onDisconnected`

## Keyboard Interaction

- **Escape**: Dismisses the tooltip and returns focus to the trigger element

### Notes

1. **Focus management**: Focus stays on the triggering element while tooltip is displayed
2. **Focus-triggered tooltips**: If tooltip is invoked when trigger receives focus, it's dismissed when trigger loses focus (onBlur)
3. **Hover-triggered tooltips**: If tooltip is invoked on mouse hover, it remains open as long as cursor is over trigger or tooltip
4. **No focusable content**: Tooltips should not contain focusable elements (use dialog for that)

## WAI-ARIA Roles, States, and Properties

### Required

- **role="tooltip"**: The element that serves as the tooltip container
- **aria-describedby**: The trigger element references the tooltip element with this attribute (set dynamically)

### Optional

- **id**: Tooltip element should have an ID for `aria-describedby` reference
- **hidden**: Tooltip should be hidden when not visible

## Best Practices

1. **Use FunctionalTemplates** for simple tooltips (native `title`)
2. **Use bElement** for ARIA tooltips with custom behavior
3. **Use spread syntax** - `{...styles.x}` for applying styles
4. **Delay appearance** - Show tooltip after a small delay (300-500ms)
5. **Quick dismissal** - Hide tooltip quickly when mouse leaves or focus is lost
6. **Escape key** - Always support Escape to dismiss tooltip
7. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce tooltip content via `aria-describedby`
- Keyboard users can access tooltips via focus
- Escape key provides quick dismissal
- Focus management ensures focus stays on trigger

## Browser Compatibility

| Browser | Native title | ARIA Tooltip |
|---------|--------------|--------------|
| Chrome | Full support | Full support |
| Firefox | Full support | Full support |
| Safari | Full support | Full support |
| Edge | Full support | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
- MDN: [ARIA tooltip role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tooltip_role)
- MDN: [HTML title attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
