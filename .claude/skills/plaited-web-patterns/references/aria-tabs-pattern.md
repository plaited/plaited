# ARIA Tabs Pattern

## Overview

Tabs are a set of layered sections of content, known as tab panels, that display one panel of content at a time. Each tab panel has an associated tab element that, when activated, displays the panel. The list of tab elements is arranged along one edge of the currently displayed panel, most commonly the top edge.

**Key Terms:**
- **Tabs** or **Tabbed Interface**: A set of tab elements and their associated tab panels
- **Tab List**: A set of tab elements contained in a tablist element
- **Tab**: An element in the tab list that serves as a label for one of the tab panels and can be activated to display that panel
- **Tab Panel**: The element that contains the content associated with a tab

**Key Characteristics:**
- **Single visible panel**: Only one tab panel is displayed at a time
- **Activation modes**: Automatic (activate on focus) or manual (activate on Space/Enter)
- **Keyboard navigation**: Arrow keys (Left/Right for horizontal, Up/Down for vertical), Home/End
- **Orientation**: Horizontal (default) or vertical
- **ARIA structure**: `role="tablist"`, `role="tab"`, `role="tabpanel"`

**Important Notes:**
- Automatic activation is recommended when tab panels can be displayed without noticeable latency
- Manual activation provides better control for users when content loading may cause delays
- Vertical orientation uses Up/Down arrows instead of Left/Right
- Tab panels that don't contain focusable elements should have `tabindex="0"` to be included in tab sequence

## Use Cases

- Content organization (settings sections, documentation sections)
- Navigation within a page (product details, user profile sections)
- Multi-step forms or wizards
- Dashboard panels with multiple views
- Content filtering (different views of the same data)
- Settings panels with grouped options
- Tabbed navigation for related content

## Implementation

### Vanilla JavaScript

```html
<!-- Horizontal Tabs -->
<div class="tabs">
  <div role="tablist" aria-label="Sample Tabs">
    <button
      role="tab"
      aria-selected="true"
      aria-controls="panel-1"
      id="tab-1"
      tabindex="0"
    >
      Tab 1
    </button>
    <button
      role="tab"
      aria-selected="false"
      aria-controls="panel-2"
      id="tab-2"
      tabindex="-1"
    >
      Tab 2
    </button>
    <button
      role="tab"
      aria-selected="false"
      aria-controls="panel-3"
      id="tab-3"
      tabindex="-1"
    >
      Tab 3
    </button>
  </div>
  <div
    id="panel-1"
    role="tabpanel"
    aria-labelledby="tab-1"
    tabindex="0"
  >
    Content for Tab 1
  </div>
  <div
    id="panel-2"
    role="tabpanel"
    aria-labelledby="tab-2"
    hidden
    tabindex="0"
  >
    Content for Tab 2
  </div>
  <div
    id="panel-3"
    role="tabpanel"
    aria-labelledby="tab-3"
    hidden
    tabindex="0"
  >
    Content for Tab 3
  </div>
</div>

<!-- Vertical Tabs -->
<div class="tabs">
  <div role="tablist" aria-label="Sample Tabs" aria-orientation="vertical">
    <!-- Tabs arranged vertically -->
  </div>
  <!-- Tab panels -->
</div>
```

```javascript
// Tabs with automatic activation
const tablist = document.querySelector('[role="tablist"]')
const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'))
const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'))

let activeTabIndex = 0

function activateTab(index) {
  // Deactivate all tabs
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', i === index ? 'true' : 'false')
    tab.setAttribute('tabindex', i === index ? '0' : '-1')
  })
  
  // Hide all panels and show active one
  panels.forEach((panel, i) => {
    panel.hidden = i !== index
  })
  
  activeTabIndex = index
  tabs[index].focus()
}

// Keyboard navigation
tablist.addEventListener('keydown', (e) => {
  const isHorizontal = tablist.getAttribute('aria-orientation') !== 'vertical'
  
  switch (e.key) {
    case 'ArrowRight':
      if (isHorizontal) {
        e.preventDefault()
        activateTab((activeTabIndex + 1) % tabs.length)
      }
      break
    case 'ArrowLeft':
      if (isHorizontal) {
        e.preventDefault()
        activateTab((activeTabIndex - 1 + tabs.length) % tabs.length)
      }
      break
    case 'ArrowDown':
      if (!isHorizontal) {
        e.preventDefault()
        activateTab((activeTabIndex + 1) % tabs.length)
      }
      break
    case 'ArrowUp':
      if (!isHorizontal) {
        e.preventDefault()
        activateTab((activeTabIndex - 1 + tabs.length) % tabs.length)
      }
      break
    case 'Home':
      e.preventDefault()
      activateTab(0)
      break
    case 'End':
      e.preventDefault()
      activateTab(tabs.length - 1)
      break
  }
})

// Click activation
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    activateTab(index)
  })
})
```

### Plaited Adaptation

**Important**: In Plaited, tabs are implemented as **bElements** because they require complex state management (active tab, panel visibility, keyboard navigation). Tab buttons can be Functional Templates (FT), but the tablist container is a bElement that manages tab state and keyboard interactions.

#### Tab Button (Functional Template)

```typescript
// button.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const TabButton: FT<{
  'aria-selected': 'true' | 'false'
  'aria-controls': string
  id: string
  tabIndex?: number
  children?: Children
}> = ({
  'aria-selected': ariaSelected,
  'aria-controls': ariaControls,
  id,
  tabIndex = 0,
  children,
  ...attrs
}) => (
  <button
    type='button'
    role='tab'
    {...attrs}
    {...joinStyles(buttonStyles.tab)}
    aria-selected={ariaSelected}
    aria-controls={ariaControls}
    id={id}
    tabIndex={tabIndex}
  >
    {children}
  </button>
)
```

#### Tabs (bElement) - Automatic Activation

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const tabsStyles = createStyles({
  tabs: {
    display: 'flex',
    flexDirection: 'column',
  },
  tablist: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid #ccc',
  },
  tablistVertical: {
    flexDirection: 'column',
    borderBottom: 'none',
    borderRight: '1px solid #ccc',
  },
  tab: {
    padding: '0.75rem 1rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    '&[aria-selected="true"]': {
      borderBottomColor: '#007bff',
      fontWeight: 'bold',
    },
  },
  tabpanel: {
    padding: '1rem',
    display: {
      $default: 'block',
      '[hidden]': 'none',
    },
  },
})

type TabsEvents = {
  tabChange: { tabId: string; panelId: string; index: number }
}

export const Tabs = bElement<TabsEvents>({
  tag: 'accessible-tabs',
  observedAttributes: ['aria-label', 'aria-orientation', 'active-index'],
  shadowDom: (
    <div {...tabsStyles.tabs}>
      <div
        p-target='tablist'
        role='tablist'
        {...tabsStyles.tablist}
        p-trigger={{ keydown: 'handleKeydown' }}
      >
        <slot name='tabs'></slot>
      </div>
      <slot name='panels'></slot>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const tablist = $('tablist')[0]
    let tabs: HTMLButtonElement[] = []
    let panels: HTMLElement[] = []
    let activeIndex = 0
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'
    
    const getTabs = (): HTMLButtonElement[] => {
      return Array.from(tablist?.querySelectorAll('[role="tab"]') || []) as HTMLButtonElement[]
    }
    
    const getPanels = (): HTMLElement[] => {
      const tabIds = tabs.map(tab => tab.getAttribute('aria-controls')).filter(Boolean) as string[]
      return tabIds
        .map(id => host.querySelector(`#${id}`))
        .filter(Boolean) as HTMLElement[]
    }
    
    const activateTab = (index: number) => {
      if (index < 0 || index >= tabs.length) return
      
      // Update tab states
      tabs.forEach((tab, i) => {
        const isActive = i === index
        tab.attr('aria-selected', isActive ? 'true' : 'false')
        tab.attr('tabIndex', isActive ? 0 : -1)
      })
      
      // Update panel visibility
      panels.forEach((panel, i) => {
        panel.attr('hidden', i !== index ? '' : null)
        // Ensure panel is in tab sequence if it doesn't have focusable content
        if (!panel.querySelector('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')) {
          panel.attr('tabIndex', i === index ? 0 : -1)
        }
      })
      
      activeIndex = index
      const activeTab = tabs[index]
      const activePanel = panels[index]
      
      emit({
        type: 'tabChange',
        detail: {
          tabId: activeTab.id,
          panelId: activePanel.id,
          index,
        },
      })
      
      return activeTab
    }
    
    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      let newIndex = activeIndex
      
      switch (direction) {
        case 'next':
          newIndex = (activeIndex + 1) % tabs.length
          break
        case 'prev':
          newIndex = (activeIndex - 1 + tabs.length) % tabs.length
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = tabs.length - 1
          break
      }
      
      const tab = activateTab(newIndex)
      tab?.focus()
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
      
      handleTabClick(event: { target: HTMLButtonElement }) {
        const clickedTab = event.target
        const index = tabs.indexOf(clickedTab)
        if (index !== -1) {
          activateTab(index)
        }
      },
      
      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        const activeIndexAttr = host.getAttribute('active-index')
        
        if (ariaLabel) {
          tablist?.setAttribute('aria-label', ariaLabel)
        }
        
        if (isVertical) {
          tablist?.setAttribute('aria-orientation', 'vertical')
        }
        
        tabs = getTabs()
        panels = getPanels()
        
        // Set up click handlers on tabs
        tabs.forEach(tab => {
          tab.setAttribute('p-trigger', JSON.stringify({ click: 'handleTabClick' }))
        })
        
        // Initialize active tab
        const initialIndex = activeIndexAttr ? Number(activeIndexAttr) : 0
        activateTab(initialIndex)
        
        // Ensure first panel is in tab sequence if needed
        const firstPanel = panels[0]
        if (firstPanel && !firstPanel.querySelector('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')) {
          firstPanel.attr('tabIndex', 0)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-label') {
          tablist?.setAttribute('aria-label', newValue || '')
        } else if (name === 'aria-orientation') {
          const isVerticalNow = newValue === 'vertical'
          if (isVerticalNow) {
            tablist?.setAttribute('aria-orientation', 'vertical')
          } else {
            tablist?.removeAttribute('aria-orientation')
          }
        } else if (name === 'active-index') {
          const index = newValue ? Number(newValue) : 0
          if (!isNaN(index) && index >= 0 && index < tabs.length) {
            activateTab(index)
          }
        }
      },
    }
  },
})
```

#### Tabs with Manual Activation

```typescript
export const ManualTabs = bElement<TabsEvents>({
  tag: 'manual-tabs',
  observedAttributes: ['aria-label', 'aria-orientation', 'active-index'],
  shadowDom: (
    <div {...tabsStyles.tabs}>
      <div
        p-target='tablist'
        role='tablist'
        {...tabsStyles.tablist}
        p-trigger={{ keydown: 'handleKeydown' }}
      >
        <slot name='tabs'></slot>
      </div>
      <slot name='panels'></slot>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const tablist = $('tablist')[0]
    let tabs: HTMLButtonElement[] = []
    let panels: HTMLElement[] = []
    let activeIndex = 0
    let focusedIndex = 0
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'
    
    const getTabs = (): HTMLButtonElement[] => {
      return Array.from(tablist?.querySelectorAll('[role="tab"]') || []) as HTMLButtonElement[]
    }
    
    const getPanels = (): HTMLElement[] => {
      const tabIds = tabs.map(tab => tab.getAttribute('aria-controls')).filter(Boolean) as string[]
      return tabIds
        .map(id => host.querySelector(`#${id}`))
        .filter(Boolean) as HTMLElement[]
    }
    
    const activateTab = (index: number) => {
      if (index < 0 || index >= tabs.length) return
      
      tabs.forEach((tab, i) => {
        const isActive = i === index
        tab.attr('aria-selected', isActive ? 'true' : 'false')
      })
      
      panels.forEach((panel, i) => {
        panel.attr('hidden', i !== index ? '' : null)
        if (!panel.querySelector('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')) {
          panel.attr('tabIndex', i === index ? 0 : -1)
        }
      })
      
      activeIndex = index
      
      emit({
        type: 'tabChange',
        detail: {
          tabId: tabs[index].id,
          panelId: panels[index].id,
          index,
        },
      })
    }
    
    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      let newIndex = focusedIndex
      
      switch (direction) {
        case 'next':
          newIndex = (focusedIndex + 1) % tabs.length
          break
        case 'prev':
          newIndex = (focusedIndex - 1 + tabs.length) % tabs.length
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = tabs.length - 1
          break
      }
      
      focusedIndex = newIndex
      tabs.forEach((tab, i) => {
        tab.attr('tabIndex', i === newIndex ? 0 : -1)
      })
      tabs[newIndex]?.focus()
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        const horizontal = !isVertical
        const activeTab = tabs[focusedIndex]
        
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
          case 'Enter':
          case ' ':
            event.preventDefault()
            activateTab(focusedIndex)
            break
        }
      },
      
      handleTabClick(event: { target: HTMLButtonElement }) {
        const clickedTab = event.target
        const index = tabs.indexOf(clickedTab)
        if (index !== -1) {
          activateTab(index)
          focusedIndex = index
        }
      },
      
      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        const activeIndexAttr = host.getAttribute('active-index')
        
        if (ariaLabel) {
          tablist?.setAttribute('aria-label', ariaLabel)
        }
        
        if (isVertical) {
          tablist?.setAttribute('aria-orientation', 'vertical')
        }
        
        tabs = getTabs()
        panels = getPanels()
        
        tabs.forEach(tab => {
          tab.setAttribute('p-trigger', JSON.stringify({ click: 'handleTabClick' }))
        })
        
        const initialIndex = activeIndexAttr ? Number(activeIndexAttr) : 0
        activateTab(initialIndex)
        focusedIndex = initialIndex
        
        tabs.forEach((tab, i) => {
          tab.attr('tabIndex', i === focusedIndex ? 0 : -1)
        })
        
        const firstPanel = panels[0]
        if (firstPanel && !firstPanel.querySelector('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')) {
          firstPanel.attr('tabIndex', 0)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-label') {
          tablist?.setAttribute('aria-label', newValue || '')
        } else if (name === 'aria-orientation') {
          const isVerticalNow = newValue === 'vertical'
          if (isVerticalNow) {
            tablist?.setAttribute('aria-orientation', 'vertical')
          } else {
            tablist?.removeAttribute('aria-orientation')
          }
        } else if (name === 'active-index') {
          const index = newValue ? Number(newValue) : 0
          if (!isNaN(index) && index >= 0 && index < tabs.length) {
            activateTab(index)
            focusedIndex = index
          }
        }
      },
    }
  },
})
```

#### Dynamic Tabs Example

```typescript
export const DynamicTabs = bElement<TabsEvents>({
  tag: 'dynamic-tabs',
  observedAttributes: ['tabs', 'panels', 'aria-label'],
  shadowDom: (
    <div {...tabsStyles.tabs}>
      <div
        p-target='tablist'
        role='tablist'
        {...tabsStyles.tablist}
        p-trigger={{ keydown: 'handleKeydown' }}
      ></div>
      <div p-target='panels-container'></div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const tablist = $('tablist')[0]
    const panelsContainer = $('panels-container')[0]
    let tabs: HTMLButtonElement[] = []
    let panels: HTMLElement[] = []
    let activeIndex = 0
    
    type TabData = {
      id: string
      label: string
      panelId: string
      panelContent: string
    }
    
    const renderTabs = (tabsData: TabData[]) => {
      if (!tablist) return
      
      const tabElements = tabsData.map((tabData, index) => (
        <button
          key={tabData.id}
          type='button'
          role='tab'
          id={`tab-${tabData.id}`}
          aria-controls={`panel-${tabData.panelId}`}
          aria-selected={index === activeIndex ? 'true' : 'false'}
          tabIndex={index === activeIndex ? 0 : -1}
          {...tabsStyles.tab}
          p-trigger={{ click: 'handleTabClick' }}
        >
          {tabData.label}
        </button>
      ))
      
      tablist.render(...tabElements)
      tabs = getTabs()
    }
    
    const renderPanels = (tabsData: TabData[]) => {
      if (!panelsContainer) return
      
      const panelElements = tabsData.map((tabData, index) => (
        <div
          key={tabData.panelId}
          role='tabpanel'
          id={`panel-${tabData.panelId}`}
          aria-labelledby={`tab-${tabData.id}`}
          hidden={index !== activeIndex}
          tabIndex={0}
          {...tabsStyles.tabpanel}
        >
          {tabData.panelContent}
        </div>
      ))
      
      panelsContainer.render(...panelElements)
      panels = Array.from(panelsContainer.querySelectorAll('[role="tabpanel"]')) as HTMLElement[]
    }
    
    const getTabs = (): HTMLButtonElement[] => {
      return Array.from(tablist?.querySelectorAll('[role="tab"]') || []) as HTMLButtonElement[]
    }
    
    const activateTab = (index: number) => {
      if (index < 0 || index >= tabs.length) return
      
      tabs.forEach((tab, i) => {
        const isActive = i === index
        tab.attr('aria-selected', isActive ? 'true' : 'false')
        tab.attr('tabIndex', isActive ? 0 : -1)
      })
      
      panels.forEach((panel, i) => {
        panel.attr('hidden', i !== index ? '' : null)
      })
      
      activeIndex = index
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            const nextIndex = (activeIndex + 1) % tabs.length
            activateTab(nextIndex)
            tabs[nextIndex]?.focus()
            break
          case 'ArrowLeft':
            event.preventDefault()
            const prevIndex = (activeIndex - 1 + tabs.length) % tabs.length
            activateTab(prevIndex)
            tabs[prevIndex]?.focus()
            break
          case 'Home':
            event.preventDefault()
            activateTab(0)
            tabs[0]?.focus()
            break
          case 'End':
            event.preventDefault()
            activateTab(tabs.length - 1)
            tabs[tabs.length - 1]?.focus()
            break
        }
      },
      
      handleTabClick(event: { target: HTMLButtonElement }) {
        const clickedTab = event.target
        const index = tabs.indexOf(clickedTab)
        if (index !== -1) {
          activateTab(index)
        }
      },
      
      onConnected() {
        const tabsAttr = host.getAttribute('tabs')
        const ariaLabel = host.getAttribute('aria-label')
        
        if (ariaLabel) {
          tablist?.setAttribute('aria-label', ariaLabel)
        }
        
        if (tabsAttr) {
          try {
            const tabsData: TabData[] = JSON.parse(tabsAttr)
            renderTabs(tabsData)
            renderPanels(tabsData)
          } catch {
            // Invalid JSON
          }
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'tabs' && newValue) {
          try {
            const tabsData: TabData[] = JSON.parse(newValue)
            renderTabs(tabsData)
            renderPanels(tabsData)
          } catch {
            // Invalid JSON
          }
        } else if (name === 'aria-label') {
          tablist?.setAttribute('aria-label', newValue || '')
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tabs can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `render()` for dynamic content, `attr()` for attribute management, `p-trigger` for event handling
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Tab List

- **Tab**: 
  - When focus moves into the tab list, places focus on the active `tab` element
  - When the tab list contains the focus, moves focus to the next element in the page tab sequence outside the tablist (typically the active tabpanel)

### Horizontal Tab List (default)

- **Left Arrow**: Moves focus to the previous tab (wraps to last if on first tab). Optionally activates the newly focused tab (automatic activation mode)
- **Right Arrow**: Moves focus to the next tab (wraps to first if on last tab). Optionally activates the newly focused tab (automatic activation mode)

### Vertical Tab List

- **Up Arrow**: Moves focus to the previous tab (wraps to last if on first tab). Optionally activates the newly focused tab (automatic activation mode)
- **Down Arrow**: Moves focus to the next tab (wraps to first if on last tab). Optionally activates the newly focused tab (automatic activation mode)

### All Orientations

- **Home**: Moves focus to the first tab. Optionally activates the newly focused tab (automatic activation mode)
- **End**: Moves focus to the last tab. Optionally activates the newly focused tab (automatic activation mode)
- **Space or Enter**: Activates the tab if it was not activated automatically on focus (manual activation mode)
- **Shift + F10**: If the tab has an associated popup menu, opens the menu
- **Delete** (Optional): If deletion is allowed, deletes (closes) the current tab element and its associated tab panel

### Activation Modes

- **Automatic Activation**: Tab panel is displayed when tab receives focus (recommended when panels load quickly)
- **Manual Activation**: Tab panel is displayed when user presses Space or Enter (better for panels with loading delays)

## WAI-ARIA Roles, States, and Properties

### Required

- **role="tablist"**: Container element for the set of tabs
- **role="tab"**: Each tab element (must be contained within tablist)
- **role="tabpanel"**: Each element containing the content panel for a tab
- **aria-controls**: Each tab must reference its associated tabpanel (via ID)
- **aria-labelledby**: Each tabpanel must reference its associated tab (via ID)
- **aria-selected**: Active tab has `aria-selected="true"`, all others have `"false"`

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for tablist (if no visible label)
- **aria-orientation**: `vertical` for vertical tabs (default is `horizontal`)
- **aria-haspopup**: Set to `menu` or `true` if tab has a popup menu
- **tabindex**: 
  - Active tab should have `tabindex="0"`
  - Inactive tabs should have `tabindex="-1"`
  - Tabpanels without focusable content should have `tabindex="0"` to be included in tab sequence

## Best Practices

1. **Automatic activation** - Use automatic activation when panels load quickly (recommended)
2. **Manual activation** - Use manual activation for panels with loading delays
3. **Single visible panel** - Only one panel should be visible at a time
4. **Proper ARIA structure** - Use correct roles and relationships
5. **Keyboard navigation** - Support arrow keys, Home, End, and activation keys
6. **Focus management** - Manage tabindex to ensure proper tab sequence
7. **Orientation** - Use `aria-orientation="vertical"` for vertical tabs
8. **Accessible names** - Provide labels for tablist and tabpanels
9. **Panel content** - Ensure panels are in tab sequence if they don't contain focusable elements
10. **Activation feedback** - Provide visual and programmatic indication of active tab

## Accessibility Considerations

- Screen readers announce tab relationships and active state
- Keyboard navigation enables efficient tab switching
- Focus management ensures logical tab sequence
- Activation modes provide flexibility for different use cases
- Proper ARIA attributes communicate structure and state
- Tab panels should be accessible via keyboard when they don't contain focusable content
- Visual indicators should complement programmatic state (aria-selected)

## Tab Variants

### Automatic Activation Tabs
- Panels activate on focus
- Recommended for quick-loading content
- Smoother navigation experience

### Manual Activation Tabs
- Panels activate on Space/Enter
- Better for content with loading delays
- More user control

### Horizontal Tabs
- Default orientation
- Left/Right arrow navigation
- Common layout pattern

### Vertical Tabs
- Vertical orientation
- Up/Down arrow navigation
- Useful for sidebar navigation

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA tabs pattern has universal support. Ensure proper keyboard navigation implementation for all browsers.

## References

- Source: [W3C ARIA Authoring Practices Guide - Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- MDN: [ARIA tab role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tab_role)
- MDN: [ARIA tablist role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role)
- MDN: [ARIA tabpanel role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tabpanel_role)
- Related: [Accordion Pattern](./aria-accordion-pattern.md) - Similar pattern for vertical stacking
