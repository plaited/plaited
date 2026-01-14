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

<!-- Using Popover API (modern) -->
<button type="button" popovertarget="save-tooltip">
  💾
</button>
<div id="save-tooltip" popover role="tooltip">
  Save your changes
</div>
```

```javascript
// ARIA Tooltip implementation
const trigger = document.getElementById('save-button')
const tooltip = document.getElementById('save-tooltip')
let showTimeout: ReturnType<typeof setTimeout> | undefined
let hideTimeout: ReturnType<typeof setTimeout> | undefined

function showTooltip() {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = undefined
  }
  
  if (showTimeout) return
  
  showTimeout = setTimeout(() => {
    tooltip.hidden = false
    showTimeout = undefined
  }, 500) // 500ms delay
}

function hideTooltip() {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = undefined
  }
  
  if (hideTimeout) return
  
  hideTimeout = setTimeout(() => {
    tooltip.hidden = true
    hideTimeout = undefined
  }, 100) // Small delay to allow moving to tooltip
}

// Show on hover
trigger.addEventListener('mouseenter', showTooltip)
trigger.addEventListener('mouseleave', hideTooltip)

// Show on focus
trigger.addEventListener('focus', showTooltip)
trigger.addEventListener('blur', hideTooltip)

// Hide on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !tooltip.hidden) {
    hideTooltip()
    trigger.focus()
  }
})

// Keep tooltip visible when hovering over it
tooltip.addEventListener('mouseenter', () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = undefined
  }
})
tooltip.addEventListener('mouseleave', hideTooltip)
```

### Plaited Adaptation

**Important**: In Plaited, tooltips can be implemented as:
1. **Native HTML `title` attribute** for simple cases (Functional Template)
2. **bElement** for ARIA tooltips with timing and positioning
3. **Native Popover API** with bElement wrapper for modern browsers

#### Simple Tooltip (Native title attribute - Functional Template)

```typescript
// tooltip.stories.tsx
import type { FT, Children } from 'plaited/ui'

const TooltipButton: FT<{
  title: string
  children?: Children
}> = ({ title, children, ...attrs }) => (
  <button
    type='button'
    title={title}
    {...attrs}
  >
    {children}
  </button>
)

export const simpleTooltip = story({
  intent: 'Button with native tooltip',
  template: () => (
    <TooltipButton title='Save your changes'>
      💾
    </TooltipButton>
  ),
})
```

#### ARIA Tooltip (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const tooltipStyles = createStyles({
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '0.5rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
    zIndex: 1000,
    pointerEvents: 'none',
    opacity: {
      $default: 0,
      '[data-visible="true"]': 1,
    },
    visibility: {
      $default: 'hidden',
      '[data-visible="true"]': 'visible',
    },
    transition: 'opacity 0.2s, visibility 0.2s',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      border: '6px solid transparent',
      borderTopColor: '#333',
    },
  },
})

type TooltipEvents = {
  show: { trigger: HTMLElement }
  hide: { trigger: HTMLElement }
}

export const Tooltip = bElement<TooltipEvents>({
  tag: 'accessible-tooltip',
  observedAttributes: ['delay', 'position'],
  shadowDom: (
    <div {...tooltipStyles.container}>
      <slot name='trigger'></slot>
      <div
        p-target='tooltip'
        role='tooltip'
        data-visible='false'
        hidden
        {...tooltipStyles.tooltip}
      >
        <slot name='content'></slot>
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
        
        // Set aria-describedby on trigger
        const tooltipId = tooltip.id || `tooltip-${Math.random().toString(36).substr(2, 9)}`
        if (!tooltip.id) {
          tooltip.id = tooltipId
        }
        trigger.setAttribute('aria-describedby', tooltipId)
        
        tooltip.attr('hidden', null)
        tooltip.attr('data-visible', 'true')
        
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
        
        tooltip.attr('hidden', '')
        tooltip.attr('data-visible', 'false')
        trigger.removeAttribute('aria-describedby')
        
        emit({ type: 'hide', detail: { trigger } })
        
        hideTimeout = undefined
      }, 100)
    }
    
    const handleTriggerMouseEnter = () => {
      showTooltip()
    }
    
    const handleTriggerMouseLeave = () => {
      hideTooltip()
    }
    
    const handleTriggerFocus = () => {
      showTooltip()
    }
    
    const handleTriggerBlur = () => {
      hideTooltip()
    }
    
    const handleTooltipMouseEnter = () => {
      // Keep tooltip visible when hovering over it
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = undefined
      }
    }
    
    const handleTooltipMouseLeave = () => {
      hideTooltip()
    }
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tooltip?.attr('data-visible') === 'true') {
        hideTooltip()
        trigger?.focus()
      }
    }
    
    return {
      onConnected() {
        trigger = getTrigger()
        if (!trigger) return
        
        const delayAttr = host.getAttribute('delay')
        if (delayAttr) {
          delay = Number(delayAttr) || 500
        }
        
        // Set up event listeners on trigger
        trigger.addEventListener('mouseenter', handleTriggerMouseEnter)
        trigger.addEventListener('mouseleave', handleTriggerMouseLeave)
        trigger.addEventListener('focus', handleTriggerFocus)
        trigger.addEventListener('blur', handleTriggerBlur)
        
        // Set up event listeners on tooltip
        if (tooltip) {
          tooltip.addEventListener('mouseenter', handleTooltipMouseEnter)
          tooltip.addEventListener('mouseleave', handleTooltipMouseLeave)
        }
        
        // Global Escape key handler
        document.addEventListener('keydown', handleEscape)
      },
      
      onDisconnected() {
        if (showTimeout) {
          clearTimeout(showTimeout)
        }
        if (hideTimeout) {
          clearTimeout(hideTimeout)
        }
        
        if (trigger) {
          trigger.removeEventListener('mouseenter', handleTriggerMouseEnter)
          trigger.removeEventListener('mouseleave', handleTriggerMouseLeave)
          trigger.removeEventListener('focus', handleTriggerFocus)
          trigger.removeEventListener('blur', handleTriggerBlur)
        }
        
        if (tooltip) {
          tooltip.removeEventListener('mouseenter', handleTooltipMouseEnter)
          tooltip.removeEventListener('mouseleave', handleTooltipMouseLeave)
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
```

#### Tooltip with Native Popover API (bElement)

```typescript
export const PopoverTooltip = bElement<TooltipEvents>({
  tag: 'popover-tooltip',
  observedAttributes: ['delay'],
  shadowDom: (
    <div {...tooltipStyles.container}>
      <slot name='trigger'></slot>
      <div
        p-target='tooltip'
        popover='auto'
        role='tooltip'
        {...tooltipStyles.tooltip}
      >
        <slot name='content'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, root }) {
    const tooltip = $<HTMLElement>('tooltip')[0]
    let trigger: HTMLElement | null = null
    let showTimeout: ReturnType<typeof setTimeout> | undefined
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
      
      if (showTimeout) return
      
      showTimeout = setTimeout(() => {
        if (!tooltip || !trigger) return
        
        const tooltipId = tooltip.id || `tooltip-${Math.random().toString(36).substr(2, 9)}`
        if (!tooltip.id) {
          tooltip.id = tooltipId
        }
        trigger.setAttribute('aria-describedby', tooltipId)
        trigger.setAttribute('popovertarget', tooltipId)
        
        tooltip.showPopover()
        
        showTimeout = undefined
      }, delay)
    }
    
    const hideTooltip = () => {
      if (!tooltip || !trigger) return
      
      if (showTimeout) {
        clearTimeout(showTimeout)
        showTimeout = undefined
      }
      
      tooltip.hidePopover()
      trigger.removeAttribute('aria-describedby')
      trigger.removeAttribute('popovertarget')
    }
    
    const handleTriggerMouseEnter = () => {
      showTooltip()
    }
    
    const handleTriggerMouseLeave = () => {
      hideTooltip()
    }
    
    const handleTriggerFocus = () => {
      showTooltip()
    }
    
    const handleTriggerBlur = () => {
      hideTooltip()
    }
    
    const handlePopoverToggle = (event: Event) => {
      const e = event as ToggleEvent
      if (e.newState === 'closed') {
        trigger?.removeAttribute('aria-describedby')
        trigger?.removeAttribute('popovertarget')
      }
    }
    
    return {
      onConnected() {
        trigger = getTrigger()
        if (!trigger) return
        
        const delayAttr = host.getAttribute('delay')
        if (delayAttr) {
          delay = Number(delayAttr) || 500
        }
        
        trigger.addEventListener('mouseenter', handleTriggerMouseEnter)
        trigger.addEventListener('mouseleave', handleTriggerMouseLeave)
        trigger.addEventListener('focus', handleTriggerFocus)
        trigger.addEventListener('blur', handleTriggerBlur)
        
        // Handle popover dismiss events
        tooltip?.addEventListener('beforetoggle', handlePopoverToggle)
      },
      
      onDisconnected() {
        if (showTimeout) {
          clearTimeout(showTimeout)
        }
        
        if (trigger) {
          trigger.removeEventListener('mouseenter', handleTriggerMouseEnter)
          trigger.removeEventListener('mouseleave', handleTriggerMouseLeave)
          trigger.removeEventListener('focus', handleTriggerFocus)
          trigger.removeEventListener('blur', handleTriggerBlur)
        }
        
        tooltip?.removeEventListener('beforetoggle', handlePopoverToggle)
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'delay') {
          delay = newValue ? Number(newValue) || 500 : 500
        }
      },
    }
  },
})
```

#### Tooltip Example Usage

```typescript
export const tooltipExample = story({
  intent: 'Icon button with tooltip',
  template: () => (
    <Tooltip delay='500'>
      <button slot='trigger' type='button' aria-label='Save'>
        💾
      </button>
      <span slot='content'>Save your changes</span>
    </Tooltip>
  ),
})

export const formFieldTooltip = story({
  intent: 'Form field with help text tooltip',
  template: () => (
    <div>
      <label htmlFor='username'>Username</label>
      <Tooltip delay='300'>
        <input
          slot='trigger'
          id='username'
          type='text'
          aria-describedby='username-tooltip'
        />
        <span slot='content' id='username-tooltip'>
          Username must be 3-20 characters and contain only letters, numbers, and underscores.
        </span>
      </Tooltip>
    </div>
  ),
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tooltips can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attribute management
- **Requires external web API**: No - uses standard DOM APIs (or Popover API for modern browsers)
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

### Native HTML

- **title attribute**: Provides basic tooltip functionality (limited styling and control)
- **popover attribute**: Modern browsers support native popover API for tooltips

## Best Practices

1. **Delay appearance** - Show tooltip after a small delay (300-500ms) to avoid accidental triggers
2. **Quick dismissal** - Hide tooltip quickly when mouse leaves or focus is lost
3. **Escape key** - Always support Escape to dismiss tooltip
4. **Positioning** - Position tooltip near trigger without obscuring content
5. **Accessible names** - Ensure trigger has accessible name (aria-label or visible text)
6. **No focusable content** - Don't include focusable elements in tooltips
7. **Native title** - Consider native `title` attribute for simple cases
8. **Popover API** - Use native Popover API when browser support allows
9. **Cleanup** - Always cleanup timers and event listeners
10. **Contextual information** - Keep tooltip text concise and relevant

## Accessibility Considerations

- Screen readers announce tooltip content via `aria-describedby`
- Keyboard users can access tooltips via focus
- Escape key provides quick dismissal
- Focus management ensures focus stays on trigger
- Tooltips don't interfere with page navigation
- Native `title` attribute works with screen readers but has limitations
- Popover API provides better accessibility features

## Tooltip Variants

### Simple Tooltip
- Native `title` attribute
- Basic functionality
- Limited styling control

### ARIA Tooltip
- Full control over appearance and behavior
- Customizable delay and positioning
- Better accessibility support

### Popover Tooltip
- Uses native Popover API
- Modern browser support
- Built-in accessibility features

### Form Field Tooltip
- Help text for form inputs
- Validation messages
- Contextual guidance

## Browser Compatibility

| Browser | Native title | ARIA Tooltip | Popover API |
|---------|--------------|--------------|-------------|
| Chrome | Full support | Full support | 114+ |
| Firefox | Full support | Full support | 114+ |
| Safari | Full support | Full support | 17+ |
| Edge | Full support | Full support | 114+ |

**Note**: 
- Native `title` attribute has universal support
- ARIA tooltip pattern has universal support
- Popover API has broad support as of 2025

## References

- Source: [W3C ARIA Authoring Practices Guide - Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
- MDN: [ARIA tooltip role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tooltip_role)
- MDN: [HTML title attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
- MDN: [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- Related: [Dialog Pattern](./aria-dialog-modal-pattern.md) - For tooltips with focusable content
- Related: [Popover Pattern](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) - Modern alternative
