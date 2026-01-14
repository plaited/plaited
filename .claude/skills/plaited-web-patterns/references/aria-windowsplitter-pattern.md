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

<!-- Horizontal Splitter -->
<div class="split-container vertical">
  <div id="primary-pane" class="pane">Primary Content</div>
  <div
    role="separator"
    aria-valuenow="50"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-orientation="vertical"
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
const secondaryPane = container.querySelector('.pane:last-child')
let currentValue = 50
let min = 0
let max = 100
let isDragging = false
let previousValue = 50
let isCollapsed = false

const isVertical = splitter.getAttribute('aria-orientation') === 'vertical'

function updateSplitter(value) {
  currentValue = Math.max(min, Math.min(max, value))
  splitter.setAttribute('aria-valuenow', String(currentValue))
  
  if (isVertical) {
    primaryPane.style.height = `${currentValue}%`
    secondaryPane.style.height = `${100 - currentValue}%`
  } else {
    primaryPane.style.width = `${currentValue}%`
    secondaryPane.style.width = `${100 - currentValue}%`
  }
}

function collapsePane() {
  if (isCollapsed) {
    // Restore previous position
    updateSplitter(previousValue)
    isCollapsed = false
  } else {
    // Collapse primary pane
    previousValue = currentValue
    updateSplitter(min)
    isCollapsed = true
  }
}

// Mouse drag
splitter.addEventListener('mousedown', (e) => {
  isDragging = true
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  
  const containerRect = container.getBoundingClientRect()
  let newValue
  
  if (isVertical) {
    const y = e.clientY - containerRect.top
    newValue = (y / containerRect.height) * 100
  } else {
    const x = e.clientX - containerRect.left
    newValue = (x / containerRect.width) * 100
  }
  
  updateSplitter(newValue)
})

document.addEventListener('mouseup', () => {
  isDragging = false
})

// Keyboard navigation
splitter.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft':
      if (!isVertical) {
        e.preventDefault()
        updateSplitter(currentValue - 5)
      }
      break
    case 'ArrowRight':
      if (!isVertical) {
        e.preventDefault()
        updateSplitter(currentValue + 5)
      }
      break
    case 'ArrowUp':
      if (isVertical) {
        e.preventDefault()
        updateSplitter(currentValue - 5)
      }
      break
    case 'ArrowDown':
      if (isVertical) {
        e.preventDefault()
        updateSplitter(currentValue + 5)
      }
      break
    case 'Enter':
      e.preventDefault()
      collapsePane()
      break
    case 'Home':
      e.preventDefault()
      updateSplitter(min)
      break
    case 'End':
      e.preventDefault()
      updateSplitter(max)
      break
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, window splitters are implemented as **bElements** because they require complex state management (value, dragging, collapse state, mouse/keyboard interactions).

#### Window Splitter (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const splitterStyles = createStyles({
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
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
    minWidth: 0,
    minHeight: 0,
  },
  splitter: {
    position: 'relative',
    backgroundColor: '#e0e0e0',
    cursor: {
      $default: 'col-resize',
      '[aria-orientation="vertical"]': 'row-resize',
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    '&:hover': {
      backgroundColor: '#d0d0d0',
    },
    '&:focus': {
      outline: '2px solid #007bff',
      outlineOffset: '-2px',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      width: {
        $default: '4px',
        '[aria-orientation="vertical"]': '100%',
      },
      height: {
        $default: '100%',
        '[aria-orientation="vertical"]': '4px',
      },
    },
  },
  splitterVertical: {
    width: '4px',
    minWidth: '4px',
  },
  splitterHorizontal: {
    height: '4px',
    minHeight: '4px',
  },
})

type SplitterEvents = {
  change: { value: number; collapsed: boolean }
  input: { value: number }
}

export const WindowSplitter = bElement<SplitterEvents>({
  tag: 'window-splitter',
  observedAttributes: ['value', 'min', 'max', 'aria-label', 'aria-orientation', 'mode', 'step'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='container'
      {...splitterStyles.container}
    >
      <div
        p-target='primary-pane'
        {...splitterStyles.primaryPane}
      >
        <slot name='primary'></slot>
      </div>
      <div
        p-target='splitter'
        role='separator'
        tabIndex={0}
        {...splitterStyles.splitter}
        p-trigger={{ keydown: 'handleKeydown', mousedown: 'handleMouseDown' }}
      ></div>
      <div
        p-target='secondary-pane'
        {...splitterStyles.secondaryPane}
      >
        <slot name='secondary'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const container = $('container')[0]
    const primaryPane = $('primary-pane')[0]
    const secondaryPane = $('secondary-pane')[0]
    const splitter = $('splitter')[0]
    
    let currentValue = 50
    let min = 0
    let max = 100
    let step = 1
    let isDragging = false
    let previousValue = 50
    let isCollapsed = false
    let mode: 'variable' | 'fixed' = 'variable'
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'
    
    const updateSplitter = (value: number, emitEvent = true) => {
      const clampedValue = Math.max(min, Math.min(max, value))
      currentValue = clampedValue
      
      // Update ARIA attributes
      splitter?.setAttribute('aria-valuenow', String(currentValue))
      splitter?.setAttribute('aria-valuemin', String(min))
      splitter?.setAttribute('aria-valuemax', String(max))
      
      // Update pane sizes
      if (primaryPane && secondaryPane) {
        if (isVertical) {
          primaryPane.style.height = `${currentValue}%`
          secondaryPane.style.height = `${100 - currentValue}%`
          primaryPane.style.width = '100%'
          secondaryPane.style.width = '100%'
        } else {
          primaryPane.style.width = `${currentValue}%`
          secondaryPane.style.width = `${100 - currentValue}%`
          primaryPane.style.height = '100%'
          secondaryPane.style.height = '100%'
        }
      }
      
      // Update host attribute
      host.setAttribute('value', String(currentValue))
      
      // Update form value
      internals.setFormValue(String(currentValue))
      
      if (emitEvent) {
        emit({
          type: 'change',
          detail: { value: currentValue, collapsed: isCollapsed },
        })
        emit({
          type: 'input',
          detail: { value: currentValue },
        })
      }
    }
    
    const collapsePane = () => {
      if (isCollapsed) {
        // Restore previous position
        updateSplitter(previousValue)
        isCollapsed = false
      } else {
        // Collapse primary pane
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
        if (mode === 'fixed') {
          // Fixed splitter only supports Enter
          if (event.key === 'Enter') {
            event.preventDefault()
            collapsePane()
          }
          return
        }
        
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
        if (mode === 'fixed') return
        
        isDragging = true
        event.preventDefault()
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },
      
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')
        const orientation = host.getAttribute('aria-orientation')
        const modeAttr = host.getAttribute('mode')
        const primaryPaneId = host.getAttribute('aria-controls')
        
        if (minAttr) {
          min = Number(minAttr) || 0
        }
        if (maxAttr) {
          max = Number(maxAttr) || 100
        }
        if (stepAttr) {
          step = Number(stepAttr) || 1
        }
        if (modeAttr === 'fixed') {
          mode = 'fixed'
        }
        
        if (valueAttr) {
          updateSplitter(Number(valueAttr), false)
        } else {
          updateSplitter(50, false)
        }
        
        if (ariaLabel) {
          splitter?.setAttribute('aria-label', ariaLabel)
        }
        
        if (orientation === 'vertical') {
          splitter?.setAttribute('aria-orientation', 'vertical')
          container?.setAttribute('class', splitterStyles.containerVertical)
        }
        
        if (primaryPaneId) {
          splitter?.setAttribute('aria-controls', primaryPaneId)
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
          step = Number(newValue) || 1
        } else if (name === 'aria-label') {
          splitter?.setAttribute('aria-label', newValue || '')
        } else if (name === 'aria-orientation') {
          const isVerticalNow = newValue === 'vertical'
          if (isVerticalNow) {
            splitter?.setAttribute('aria-orientation', 'vertical')
            container?.setAttribute('class', splitterStyles.containerVertical)
          } else {
            splitter?.removeAttribute('aria-orientation')
            container?.removeAttribute('class')
          }
        } else if (name === 'mode') {
          mode = newValue === 'fixed' ? 'fixed' : 'variable'
        }
      },
      
      onDisconnected() {
        // Cleanup mouse event listeners
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      },
    }
  },
})
```

#### Fixed Splitter Example

```typescript
export const FixedSplitter = bElement<SplitterEvents>({
  tag: 'fixed-splitter',
  observedAttributes: ['value', 'aria-label', 'aria-orientation'],
  shadowDom: (
    <div
      p-target='container'
      {...splitterStyles.container}
    >
      <div
        p-target='primary-pane'
        {...splitterStyles.primaryPane}
      >
        <slot name='primary'></slot>
      </div>
      <div
        p-target='splitter'
        role='separator'
        tabIndex={0}
        {...splitterStyles.splitter}
        p-trigger={{ keydown: 'handleKeydown' }}
      ></div>
      <div
        p-target='secondary-pane'
        {...splitterStyles.secondaryPane}
      >
        <slot name='secondary'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const primaryPane = $('primary-pane')[0]
    const secondaryPane = $('secondary-pane')[0]
    const splitter = $('splitter')[0]
    
    let isExpanded = true
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'
    
    const toggleSplitter = () => {
      isExpanded = !isExpanded
      
      if (primaryPane && secondaryPane) {
        if (isExpanded) {
          if (isVertical) {
            primaryPane.style.height = 'auto'
            secondaryPane.style.height = 'auto'
          } else {
            primaryPane.style.width = 'auto'
            secondaryPane.style.width = 'auto'
          }
          splitter?.setAttribute('aria-valuenow', '50')
        } else {
          if (isVertical) {
            primaryPane.style.height = '0'
            secondaryPane.style.height = '100%'
          } else {
            primaryPane.style.width = '0'
            secondaryPane.style.width = '100%'
          }
          splitter?.setAttribute('aria-valuenow', '0')
        }
      }
      
      emit({
        type: 'change',
        detail: { value: isExpanded ? 50 : 0, collapsed: !isExpanded },
      })
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
          event.preventDefault()
          toggleSplitter()
        }
      },
      
      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        const orientation = host.getAttribute('aria-orientation')
        
        if (ariaLabel) {
          splitter?.setAttribute('aria-label', ariaLabel)
        }
        
        if (orientation === 'vertical') {
          splitter?.setAttribute('aria-orientation', 'vertical')
        }
        
        splitter?.setAttribute('aria-valuenow', '50')
        splitter?.setAttribute('aria-valuemin', '0')
        splitter?.setAttribute('aria-valuemax', '100')
      },
    }
  },
})
```

#### Splitter Example Usage

```typescript
export const splitterExample = story({
  intent: 'Code editor with resizable sidebar',
  template: () => (
    <WindowSplitter
      value='25'
      min='10'
      max='80'
      step='5'
      aria-label='File Explorer'
      aria-controls='file-explorer'
    >
      <div slot='primary' id='file-explorer'>
        <h2>File Explorer</h2>
        <ul>
          <li>src/</li>
          <li>public/</li>
          <li>package.json</li>
        </ul>
      </div>
      <div slot='secondary'>
        <h2>Code Editor</h2>
        <pre>function hello() {}</pre>
      </div>
    </WindowSplitter>
  ),
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - splitters can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attribute management, `p-trigger` for event handling
- **Requires external web API**: No - uses standard DOM APIs (mouse events)
- **Cleanup required**: Yes - mouse event listeners must be cleaned up in `onDisconnected`

## Keyboard Interaction

### Variable Splitter

- **Left Arrow** (horizontal): Moves splitter left (decreases primary pane size)
- **Right Arrow** (horizontal): Moves splitter right (increases primary pane size)
- **Up Arrow** (vertical): Moves splitter up (decreases primary pane size)
- **Down Arrow** (vertical): Moves splitter down (increases primary pane size)
- **Enter**: Collapses primary pane if not collapsed, or restores to previous position if collapsed
- **Home** (Optional): Moves splitter to minimum position (primary pane smallest)
- **End** (Optional): Moves splitter to maximum position (primary pane largest)

### Fixed Splitter

- **Enter**: Toggles between two positions (collapsed/expanded)
- **Arrow keys**: Not implemented for fixed splitters

### Optional

- **F6** (Optional): Cycle through window panes

## WAI-ARIA Roles, States, and Properties

### Required

- **role="separator"**: The element that serves as the focusable splitter
- **aria-valuenow**: Decimal value representing current position (0-100)
- **aria-valuemin**: Decimal value for minimum position (typically 0)
- **aria-valuemax**: Decimal value for maximum position (typically 100)

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for splitter (should match primary pane name)
- **aria-controls**: References the primary pane element
- **aria-orientation**: `vertical` for horizontal splitter (top/bottom panes), default is horizontal (left/right panes)

## Best Practices

1. **Accessible name** - Splitter label should match primary pane name
2. **Value range** - Use 0-100 for percentage-based sizing
3. **Step size** - Provide reasonable step size for keyboard navigation
4. **Collapse state** - Remember previous position when collapsing
5. **Visual feedback** - Provide clear visual indication of splitter position
6. **Mouse drag** - Support mouse dragging for variable splitters
7. **Keyboard navigation** - Support all standard keyboard interactions
8. **Orientation** - Use `aria-orientation` for vertical splitters
9. **Fixed vs Variable** - Clearly distinguish between fixed and variable modes
10. **Minimum sizes** - Ensure panes don't become too small to be usable

## Accessibility Considerations

- Screen readers announce splitter value and position
- Keyboard navigation enables efficient splitter adjustment
- Collapse/expand functionality improves usability
- Proper ARIA attributes communicate state and purpose
- Visual feedback complements programmatic state
- Mouse drag provides alternative interaction method

## Splitter Variants

### Variable Splitter
- Adjustable to any position
- Arrow keys move splitter
- Mouse drag supported
- Most common type

### Fixed Splitter
- Toggles between two positions
- Only Enter key supported
- No arrow key navigation
- Simpler implementation

### Vertical Splitter
- Top/bottom panes
- Up/Down arrows move splitter
- Horizontal resize cursor

### Horizontal Splitter
- Left/right panes
- Left/Right arrows move splitter
- Vertical resize cursor

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA separator role with value properties has universal support. Ensure proper keyboard navigation implementation for all browsers.

## References

- Source: [W3C ARIA Authoring Practices Guide - Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
- MDN: [ARIA separator role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/separator_role)
- Related: [Slider Pattern](./aria-slider-pattern.md) - Similar value-based interaction
- Related: [Grid Pattern](./aria-grid-pattern.md) - Can contain splitters for resizable panels
