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
- Tab panels that don't contain focusable elements should have `tabindex="0"` to be included in tab sequence

## Use Cases

- Content organization (settings sections, documentation sections)
- Navigation within a page (product details, user profile sections)
- Multi-step forms or wizards
- Dashboard panels with multiple views
- Content filtering (different views of the same data)
- Settings panels with grouped options

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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
</div>
```

```javascript
// Tabs with automatic activation
const tablist = document.querySelector('[role="tablist"]')
const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'))
const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'))

let activeTabIndex = 0

function activateTab(index) {
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', i === index ? 'true' : 'false')
    tab.setAttribute('tabindex', i === index ? '0' : '-1')
  })

  panels.forEach((panel, i) => {
    panel.hidden = i !== index
  })

  activeTabIndex = index
  tabs[index].focus()
}

tablist.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      activateTab((activeTabIndex + 1) % tabs.length)
      break
    case 'ArrowLeft':
      e.preventDefault()
      activateTab((activeTabIndex - 1 + tabs.length) % tabs.length)
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
```

### Plaited Adaptation

**Important**: In Plaited, tabs are implemented as **bElements** because they require complex state management (active tab, panel visibility, keyboard navigation).

**File Structure:**

```
tabs/
  tabs.css.ts        # Styles (createStyles) - ALWAYS separate
  tabs.stories.tsx   # bElement + stories (imports from css.ts)
```

#### tabs.css.ts

```typescript
// tabs.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  tabs: {
    display: 'flex',
    flexDirection: 'column',
  },
  tablist: {
    display: 'flex',
    gap: '0.5rem',
    borderBlockEnd: '1px solid #ccc',
  },
  tablistVertical: {
    flexDirection: 'column',
    borderBlockEnd: 'none',
    borderInlineEnd: '1px solid #ccc',
  },
  tab: {
    padding: '0.75rem 1rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderBlockEnd: '2px solid transparent',
  },
  tabSelected: {
    borderBlockEndColor: '#007bff',
    fontWeight: 'bold',
  },
  tabpanel: {
    padding: '1rem',
  },
  tabpanelHidden: {
    display: 'none',
  },
})
```

#### tabs.stories.tsx

```typescript
// tabs.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './tabs.css.ts'

// Types - defined locally
type TabsEvents = {
  tabChange: { tabId: string; panelId: string; index: number }
}

// bElement for tabs - defined locally, NOT exported
const Tabs = bElement<TabsEvents>({
  tag: 'pattern-tabs',
  observedAttributes: ['aria-label', 'aria-orientation', 'active-index'],
  hostStyles,
  shadowDom: (
    <div {...styles.tabs}>
      <div
        p-target='tablist'
        role='tablist'
        {...styles.tablist}
        p-trigger={{ keydown: 'handleKeydown' }}
      >
        <slot name='tabs'></slot>
      </div>
      <div p-target='panels'>
        <slot name='panels'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const tablist = $('tablist')[0]
    let tabs: HTMLButtonElement[] = []
    let panels: HTMLElement[] = []
    let activeIndex = 0
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'

    const getTabs = (): HTMLButtonElement[] => {
      const slot = tablist?.querySelector('slot[name="tabs"]') as HTMLSlotElement
      if (!slot) return []
      return Array.from(slot.assignedElements()).filter(
        (el) => el.getAttribute('role') === 'tab'
      ) as HTMLButtonElement[]
    }

    const getPanels = (): HTMLElement[] => {
      const panelsContainer = $('panels')[0]
      const slot = panelsContainer?.querySelector('slot[name="panels"]') as HTMLSlotElement
      if (!slot) return []
      return Array.from(slot.assignedElements()).filter(
        (el) => el.getAttribute('role') === 'tabpanel'
      ) as HTMLElement[]
    }

    const activateTab = (index: number) => {
      if (index < 0 || index >= tabs.length) return

      tabs.forEach((tab, i) => {
        const isActive = i === index
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
        tab.setAttribute('tabindex', isActive ? '0' : '-1')
        if (isActive) {
          tab.setAttribute('class', `${styles.tab.classNames.join(' ')} ${styles.tabSelected.classNames.join(' ')}`)
        } else {
          tab.setAttribute('class', styles.tab.classNames.join(' '))
        }
      })

      panels.forEach((panel, i) => {
        if (i !== index) {
          panel.setAttribute('hidden', '')
          panel.setAttribute('class', `${styles.tabpanel.classNames.join(' ')} ${styles.tabpanelHidden.classNames.join(' ')}`)
        } else {
          panel.removeAttribute('hidden')
          panel.setAttribute('class', styles.tabpanel.classNames.join(' '))
        }
      })

      activeIndex = index
      const activeTab = tabs[index]
      const activePanel = panels[index]

      emit({
        type: 'tabChange',
        detail: {
          tabId: activeTab?.id || '',
          panelId: activePanel?.id || '',
          index,
        },
      })
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

      activateTab(newIndex)
      tabs[newIndex]?.focus()
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

      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        const activeIndexAttr = host.getAttribute('active-index')

        if (ariaLabel) {
          tablist?.setAttribute('aria-label', ariaLabel)
        }

        if (isVertical) {
          tablist?.setAttribute('aria-orientation', 'vertical')
          tablist?.setAttribute('class', `${styles.tablist.classNames.join(' ')} ${styles.tablistVertical.classNames.join(' ')}`)
        }

        // Wait for slot content
        setTimeout(() => {
          tabs = getTabs()
          panels = getPanels()

          // Add click handlers to tabs
          tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => {
              activateTab(i)
            })
            tab.setAttribute('class', styles.tab.classNames.join(' '))
          })

          panels.forEach((panel) => {
            panel.setAttribute('class', styles.tabpanel.classNames.join(' '))
          })

          const initialIndex = activeIndexAttr ? Number(activeIndexAttr) : 0
          activateTab(initialIndex)
        }, 0)
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-label') {
          tablist?.setAttribute('aria-label', newValue || '')
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

// Stories - EXPORTED for testing/training
export const horizontalTabs = story({
  intent: 'Horizontal tabs with automatic activation',
  template: () => (
    <Tabs aria-label='Content sections'>
      <button slot='tabs' role='tab' id='tab-1' aria-controls='panel-1'>
        Tab 1
      </button>
      <button slot='tabs' role='tab' id='tab-2' aria-controls='panel-2'>
        Tab 2
      </button>
      <button slot='tabs' role='tab' id='tab-3' aria-controls='panel-3'>
        Tab 3
      </button>
      <div slot='panels' role='tabpanel' id='panel-1' aria-labelledby='tab-1'>
        Content for Tab 1
      </div>
      <div slot='panels' role='tabpanel' id='panel-2' aria-labelledby='tab-2'>
        Content for Tab 2
      </div>
      <div slot='panels' role='tabpanel' id='panel-3' aria-labelledby='tab-3'>
        Content for Tab 3
      </div>
    </Tabs>
  ),
  play: async ({ findByRole, assert }) => {
    const tab1 = await findByRole('tab', { name: 'Tab 1' })

    assert({
      given: 'tabs are rendered',
      should: 'have first tab selected',
      actual: tab1?.getAttribute('aria-selected'),
      expected: 'true',
    })
  },
})

export const verticalTabs = story({
  intent: 'Vertical tabs with up/down arrow navigation',
  template: () => (
    <Tabs aria-label='Settings sections' aria-orientation='vertical'>
      <button slot='tabs' role='tab' id='tab-general' aria-controls='panel-general'>
        General
      </button>
      <button slot='tabs' role='tab' id='tab-privacy' aria-controls='panel-privacy'>
        Privacy
      </button>
      <div slot='panels' role='tabpanel' id='panel-general' aria-labelledby='tab-general'>
        General settings content
      </div>
      <div slot='panels' role='tabpanel' id='panel-privacy' aria-labelledby='tab-privacy'>
        Privacy settings content
      </div>
    </Tabs>
  ),
  play: async ({ findByAttribute, assert }) => {
    const tablist = await findByAttribute('role', 'tablist')

    assert({
      given: 'vertical tabs',
      should: 'have vertical orientation',
      actual: tablist?.getAttribute('aria-orientation'),
      expected: 'vertical',
    })
  },
})

export const tabsAccessibility = story({
  intent: 'Verify tabs accessibility structure',
  template: () => (
    <Tabs aria-label='Test tabs'>
      <button slot='tabs' role='tab' id='test-tab-1' aria-controls='test-panel-1'>
        Test Tab
      </button>
      <div slot='panels' role='tabpanel' id='test-panel-1' aria-labelledby='test-tab-1'>
        Test content
      </div>
    </Tabs>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tabs can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Tab List

- **Tab**: When focus moves into the tab list, places focus on the active `tab` element
- **Shift + Tab**: Moves focus to the previous focusable element

### Horizontal Tab List (default)

- **Left Arrow**: Moves focus to previous tab (wraps to last if on first)
- **Right Arrow**: Moves focus to next tab (wraps to first if on last)

### Vertical Tab List

- **Up Arrow**: Moves focus to previous tab (wraps to last if on first)
- **Down Arrow**: Moves focus to next tab (wraps to first if on last)

### All Orientations

- **Home**: Moves focus to first tab
- **End**: Moves focus to last tab
- **Space or Enter**: Activates the tab (manual activation mode)

## WAI-ARIA Roles, States, and Properties

### Required

- **role="tablist"**: Container element for the set of tabs
- **role="tab"**: Each tab element (must be contained within tablist)
- **role="tabpanel"**: Each element containing the content panel for a tab
- **aria-controls**: Each tab must reference its associated tabpanel (via ID)
- **aria-labelledby**: Each tabpanel must reference its associated tab (via ID)
- **aria-selected**: Active tab has `aria-selected="true"`, all others have `"false"`

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for tablist
- **aria-orientation**: `vertical` for vertical tabs (default is `horizontal`)

## Best Practices

1. **Use bElement** - Tabs require complex state management
2. **Use spread syntax** - `{...styles.x}` for applying styles
3. **Automatic activation** - Use when panels load quickly (recommended)
4. **Manual activation** - Use for panels with loading delays
5. **Proper ARIA structure** - Use correct roles and relationships
6. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce tab relationships and active state
- Keyboard navigation enables efficient tab switching
- Focus management ensures logical tab sequence
- Proper ARIA attributes communicate structure and state

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- MDN: [ARIA tab role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tab_role)
- MDN: [ARIA tablist role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role)
- Related: [Accordion Pattern](./aria-accordion-pattern.md) - Similar pattern for vertical stacking
