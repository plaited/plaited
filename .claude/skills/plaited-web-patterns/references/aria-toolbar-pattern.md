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
- In horizontal toolbars, Left/Right arrows navigate; Up/Down can duplicate or operate controls
- In vertical toolbars, Up/Down arrows navigate; Left/Right can duplicate or operate controls
- Avoid including controls that require the same arrow keys used for navigation (or place them last)
- Disabled controls are typically not focusable, but may be focusable for discoverability

## Use Cases

- Text editor toolbars (formatting, alignment, styles)
- Image editor toolbars (tools, filters, adjustments)
- Form builder toolbars (add fields, configure options)
- Dashboard control panels (filters, views, actions)
- Drawing/design toolbars (shapes, colors, tools)
- Media player controls (play, pause, volume, settings)
- Document editor toolbars (bold, italic, lists, links)

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

<!-- Vertical Toolbar -->
<div role="toolbar" aria-label="Tools" aria-orientation="vertical">
  <button type="button" tabindex="0">Select</button>
  <button type="button" tabindex="-1">Brush</button>
  <button type="button" tabindex="-1">Eraser</button>
</div>
```

```javascript
// Toolbar with roving tabindex
const toolbar = document.querySelector('[role="toolbar"]')
const controls = Array.from(toolbar.querySelectorAll('button, [role="button"], [role="checkbox"], [role="menubutton"]'))
let focusedIndex = 0
const isVertical = toolbar.getAttribute('aria-orientation') === 'vertical'

// Get focusable controls (skip disabled unless needed for discoverability)
function getFocusableControls() {
  return controls.filter(control => {
    const disabled = control.hasAttribute('disabled') || 
                     control.getAttribute('aria-disabled') === 'true'
    // Typically skip disabled, but can include for discoverability
    return !disabled
  })
}

// Update tabindex for roving tabindex
function updateTabindex(index) {
  const focusableControls = getFocusableControls()
  focusableControls.forEach((control, i) => {
    control.setAttribute('tabindex', i === index ? '0' : '-1')
  })
}

// Move focus
function moveFocus(direction) {
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

// Handle focus entering toolbar
toolbar.addEventListener('focusin', (e) => {
  if (controls.includes(e.target)) {
    focusedIndex = getFocusableControls().indexOf(e.target)
    if (focusedIndex === -1) focusedIndex = 0
    updateTabindex(focusedIndex)
  } else {
    // Focus entering toolbar - focus first control
    focusedIndex = 0
    updateTabindex(0)
    getFocusableControls()[0]?.focus()
  }
})

// Keyboard navigation
toolbar.addEventListener('keydown', (e) => {
  const horizontal = !isVertical
  
  switch (e.key) {
    case 'ArrowRight':
      if (horizontal) {
        e.preventDefault()
        moveFocus('next')
      }
      break
    case 'ArrowLeft':
      if (horizontal) {
        e.preventDefault()
        moveFocus('prev')
      }
      break
    case 'ArrowDown':
      if (!horizontal) {
        e.preventDefault()
        moveFocus('next')
      }
      break
    case 'ArrowUp':
      if (!horizontal) {
        e.preventDefault()
        moveFocus('prev')
      }
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

**Important**: In Plaited, toolbars are implemented as **bElements** because they require complex state management (roving tabindex, focus tracking, keyboard navigation). The toolbar container manages focus and tabindex for all slotted controls.

#### Toolbar (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const toolbarStyles = createStyles({
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
})

type ToolbarEvents = {
  controlActivate: { control: HTMLElement; index: number }
}

export const Toolbar = bElement<ToolbarEvents>({
  tag: 'accessible-toolbar',
  observedAttributes: ['aria-label', 'aria-orientation'],
  shadowDom: (
    <div
      p-target='toolbar'
      role='toolbar'
      {...toolbarStyles.toolbar}
      p-trigger={{ keydown: 'handleKeydown', focusin: 'handleFocusIn', focusout: 'handleFocusOut' }}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const toolbar = $('toolbar')[0]
    let controls: HTMLElement[] = []
    let focusedIndex = 0
    let lastFocusedIndex = 0
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'
    
    const getControls = (): HTMLElement[] => {
      // Get all interactive controls from slot
      const slot = toolbar?.querySelector('slot') as HTMLSlotElement
      if (!slot) return []
      
      const assignedNodes = slot.assignedNodes()
      const elements: HTMLElement[] = []
      
      assignedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement
          // Include buttons, menubuttons, checkboxes, and other interactive controls
          if (
            element.tagName === 'BUTTON' ||
            element.getAttribute('role') === 'button' ||
            element.getAttribute('role') === 'menubutton' ||
            element.getAttribute('role') === 'checkbox' ||
            element.getAttribute('role') === 'radio' ||
            element.tagName === 'INPUT' ||
            element.tagName === 'SELECT'
          ) {
            elements.push(element)
          }
          // Also check for nested controls
          const nestedControls = element.querySelectorAll(
            'button, [role="button"], [role="menubutton"], [role="checkbox"], [role="radio"], input, select'
          )
          nestedControls.forEach(control => {
            if (!elements.includes(control as HTMLElement)) {
              elements.push(control as HTMLElement)
            }
          })
        }
      })
      
      return elements
    }
    
    const isControlDisabled = (control: HTMLElement): boolean => {
      return (
        control.hasAttribute('disabled') ||
        control.getAttribute('aria-disabled') === 'true' ||
        (control as HTMLButtonElement).disabled === true
      )
    }
    
    const getFocusableControls = (): HTMLElement[] => {
      return controls.filter(control => !isControlDisabled(control))
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
      
      lastFocusedIndex = focusedIndex
      updateTabindex(focusedIndex)
      focusableControls[focusedIndex].focus()
    }
    
    const initializeFocus = () => {
      controls = getControls()
      const focusableControls = getFocusableControls()
      
      if (focusableControls.length === 0) return
      
      // If toolbar previously had focus, restore to last focused control
      // Otherwise, focus first control
      if (lastFocusedIndex >= 0 && lastFocusedIndex < focusableControls.length) {
        focusedIndex = lastFocusedIndex
      } else {
        focusedIndex = 0
      }
      
      updateTabindex(focusedIndex)
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        const horizontal = !isVertical
        const target = event.target as HTMLElement
        
        // Only handle if focus is within toolbar
        if (!toolbar?.contains(target)) return
        
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
        
        // If focus is on a control within toolbar
        if (focusableControls.includes(target)) {
          focusedIndex = focusableControls.indexOf(target)
          if (focusedIndex === -1) focusedIndex = 0
          lastFocusedIndex = focusedIndex
          updateTabindex(focusedIndex)
        } else if (toolbar?.contains(target)) {
          // Focus entering toolbar but not on a control - focus first control
          initializeFocus()
          const focusableControls = getFocusableControls()
          if (focusableControls.length > 0) {
            focusableControls[focusedIndex].focus()
          }
        }
      },
      
      handleFocusOut(event: FocusEvent) {
        // Store last focused index for restoration
        const target = event.target as HTMLElement
        if (target && controls.includes(target)) {
          const focusableControls = getFocusableControls()
          const index = focusableControls.indexOf(target)
          if (index !== -1) {
            lastFocusedIndex = index
          }
        }
      },
      
      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        
        if (ariaLabel) {
          toolbar?.setAttribute('aria-label', ariaLabel)
        }
        
        if (isVertical) {
          toolbar?.setAttribute('aria-orientation', 'vertical')
        }
        
        // Wait for slot content to be assigned
        setTimeout(() => {
          initializeFocus()
        }, 0)
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-label') {
          toolbar?.setAttribute('aria-label', newValue || '')
        } else if (name === 'aria-orientation') {
          const isVerticalNow = newValue === 'vertical'
          if (isVerticalNow) {
            toolbar?.setAttribute('aria-orientation', 'vertical')
          } else {
            toolbar?.removeAttribute('aria-orientation')
          }
        }
      },
    }
  },
})
```

#### Toolbar with Mixed Controls

```typescript
export const EditorToolbar = bElement<ToolbarEvents>({
  tag: 'editor-toolbar',
  observedAttributes: ['aria-label'],
  shadowDom: (
    <div
      p-target='toolbar'
      role='toolbar'
      aria-label='Text Formatting'
      {...toolbarStyles.toolbar}
      p-trigger={{ keydown: 'handleKeydown', focusin: 'handleFocusIn', focusout: 'handleFocusOut' }}
    >
      <slot name='controls'></slot>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const toolbar = $('toolbar')[0]
    let controls: HTMLElement[] = []
    let focusedIndex = 0
    let lastFocusedIndex = 0
    
    const getControls = (): HTMLElement[] => {
      const slot = toolbar?.querySelector('slot[name="controls"]') as HTMLSlotElement
      if (!slot) return []
      
      const assignedNodes = slot.assignedNodes()
      const elements: HTMLElement[] = []
      
      assignedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement
          // Collect all interactive controls
          if (
            element.tagName === 'BUTTON' ||
            element.getAttribute('role') === 'button' ||
            element.getAttribute('role') === 'menubutton' ||
            element.getAttribute('role') === 'checkbox'
          ) {
            elements.push(element)
          }
        }
      })
      
      return elements
    }
    
    const getFocusableControls = (): HTMLElement[] => {
      return controls.filter(control => {
        const disabled = control.hasAttribute('disabled') ||
                         control.getAttribute('aria-disabled') === 'true' ||
                         (control as HTMLButtonElement).disabled === true
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
      
      lastFocusedIndex = focusedIndex
      updateTabindex(focusedIndex)
      focusableControls[focusedIndex].focus()
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        const target = event.target as HTMLElement
        if (!toolbar?.contains(target)) return
        
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            moveFocus('next')
            break
          case 'ArrowLeft':
            event.preventDefault()
            moveFocus('prev')
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
          if (focusedIndex === -1) focusedIndex = 0
          lastFocusedIndex = focusedIndex
          updateTabindex(focusedIndex)
        } else if (toolbar?.contains(target)) {
          controls = getControls()
          const focusableControls = getFocusableControls()
          if (focusableControls.length > 0) {
            focusedIndex = lastFocusedIndex >= 0 && lastFocusedIndex < focusableControls.length
              ? lastFocusedIndex
              : 0
            updateTabindex(focusedIndex)
            focusableControls[focusedIndex].focus()
          }
        }
      },
      
      handleFocusOut(event: FocusEvent) {
        const target = event.target as HTMLElement
        if (target && controls.includes(target)) {
          const focusableControls = getFocusableControls()
          const index = focusableControls.indexOf(target)
          if (index !== -1) {
            lastFocusedIndex = index
          }
        }
      },
      
      onConnected() {
        setTimeout(() => {
          controls = getControls()
          const focusableControls = getFocusableControls()
          if (focusableControls.length > 0) {
            focusedIndex = 0
            updateTabindex(0)
          }
        }, 0)
      },
    }
  },
})
```

#### Toolbar Example Usage

```typescript
export const toolbarExample = story({
  intent: 'Text editor toolbar with formatting controls',
  template: () => (
    <EditorToolbar aria-label='Text Formatting'>
      <button
        slot='controls'
        type='button'
        aria-pressed='false'
        p-trigger={{ click: 'handleBold' }}
      >
        Bold
      </button>
      <button
        slot='controls'
        type='button'
        aria-pressed='false'
        p-trigger={{ click: 'handleItalic' }}
      >
        Italic
      </button>
      <button
        slot='controls'
        type='button'
        aria-pressed='false'
        p-trigger={{ click: 'handleUnderline' }}
      >
        Underline
      </button>
      <button
        slot='controls'
        type='button'
        p-trigger={{ click: 'handleLink' }}
      >
        Link
      </button>
      <button
        slot='controls'
        type='button'
        p-trigger={{ click: 'handleImage' }}
      >
        Image
      </button>
    </EditorToolbar>
  ),
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - toolbars can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for tabindex management, `p-trigger` for event handling
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Entering/Exiting Toolbar

- **Tab**: Moves focus into the toolbar (focuses first control that is not disabled, or last focused control if previously focused)
- **Shift + Tab**: Moves focus out of the toolbar

### Horizontal Toolbar (default)

- **Left Arrow**: Moves focus to the previous control (optionally wraps from first to last)
- **Right Arrow**: Moves focus to the next control (optionally wraps from last to first)
- **Up Arrow / Down Arrow**: Can duplicate Left/Right arrows, or can be reserved for operating controls (e.g., spin buttons)

### Vertical Toolbar

- **Up Arrow**: Moves focus to the previous control (optionally wraps from first to last)
- **Down Arrow**: Moves focus to the next control (optionally wraps from last to first)
- **Left Arrow / Right Arrow**: Can duplicate Up/Down arrows, or can be reserved for operating controls (e.g., sliders)

### All Orientations

- **Home** (Optional): Moves focus to the first control
- **End** (Optional): Moves focus to the last control

### Notes

1. **Roving tabindex**: Only one control has `tabindex="0"`, all others have `tabindex="-1"`
2. **Disabled controls**: Typically not focusable, but may be focusable for discoverability
3. **Focus restoration**: When focus returns to toolbar, it can restore to the last focused control
4. **Control operation**: Controls within toolbar maintain their own keyboard interactions (Space, Enter, etc.)

## WAI-ARIA Roles, States, and Properties

### Required

- **role="toolbar"**: Container element for the toolbar

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for toolbar (required if no visible label)
- **aria-orientation**: `vertical` for vertical toolbars (default is `horizontal`)

### Control Requirements

Controls within the toolbar should:
- Have appropriate roles (`button`, `menubutton`, `checkbox`, etc.)
- Use roving tabindex (only one has `tabindex="0"`)
- Maintain their own ARIA states (`aria-pressed`, `aria-checked`, `aria-expanded`, etc.)

## Best Practices

1. **Minimum controls** - Use toolbar only if it contains 3 or more controls
2. **Roving tabindex** - Implement proper roving tabindex (single tab stop)
3. **Focus management** - Restore focus to last focused control when re-entering
4. **Orientation** - Use `aria-orientation="vertical"` for vertical toolbars
5. **Accessible names** - Always provide `aria-label` or `aria-labelledby`
6. **Disabled controls** - Typically skip disabled controls, but can include for discoverability
7. **Arrow key conflicts** - Avoid controls that require the same arrow keys used for navigation (or place them last)
8. **Control types** - Support buttons, menubuttons, checkboxes, and other interactive controls
9. **Keyboard shortcuts** - Consider adding shortcuts to quickly access toolbar from context
10. **Visual grouping** - Ensure visual design clearly groups controls together

## Accessibility Considerations

- Screen readers announce toolbar and its purpose
- Roving tabindex reduces tab stops for keyboard users
- Arrow key navigation enables efficient control access
- Focus management ensures logical navigation flow
- Proper ARIA attributes communicate structure and purpose
- Disabled controls may be focusable for discoverability
- Controls maintain their own keyboard interactions

## Toolbar Variants

### Horizontal Toolbar
- Default orientation
- Left/Right arrow navigation
- Common for top/bottom toolbars

### Vertical Toolbar
- Vertical orientation
- Up/Down arrow navigation
- Common for sidebar toolbars

### Mixed Control Toolbar
- Contains different control types
- Buttons, menubuttons, checkboxes
- All use roving tabindex

### Multi-Row Toolbar
- Multiple rows of controls
- Left/Right arrows wrap between rows
- Vertical arrows can operate controls

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA toolbar pattern has universal support. Ensure proper roving tabindex implementation for all browsers.

## References

- Source: [W3C ARIA Authoring Practices Guide - Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- MDN: [ARIA toolbar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/toolbar_role)
- Related: [Menu Button Pattern](./aria-menubutton-pattern.md) - Can be used within toolbars
- Related: [Radio Group Pattern](./aria-radio-pattern.md) - Can be used within toolbars (toolbar mode)
- Related: [Checkbox Pattern](./aria-checkbox-pattern.md) - Can be used within toolbars
