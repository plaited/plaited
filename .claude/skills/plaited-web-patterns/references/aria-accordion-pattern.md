# ARIA Accordion Pattern

## Overview

An accordion is a vertically stacked set of interactive headings. Each contain a title, content snippet, or thumbnail representing a section of content. The headings function as controls that enable users to reveal or hide their associated sections of content. Accordions are commonly used to reduce the need to scroll when presenting multiple sections of content on a single page.

**Key Terms:**
- **Accordion Header**: Label or thumbnail representing a section that serves as a control for showing/hiding content
- **Accordion Panel**: Section of content associated with an accordion header

## Use Cases

- Organizing form sections when only one section should be shown at a time.
- FAQ sections with expandable answers
- Navigation menus with collapsible sections
- Content organization to reduce scrolling
- Settings panels with grouped options
- Multi-step wizards or processes

## Implementation

### Vanilla JavaScript

```html
<div class="accordion">
  <h3>
    <button 
      type="button"
      aria-expanded="false"
      aria-controls="panel-1"
      id="header-1"
    >
      Section 1
    </button>
  </h3>
  <div 
    id="panel-1"
    role="region"
    aria-labelledby="header-1"
    hidden
  >
    Content for section 1
  </div>
  
  <h3>
    <button 
      type="button"
      aria-expanded="true"
      aria-controls="panel-2"
      id="header-2"
    >
      Section 2
    </button>
  </h3>
  <div 
    id="panel-2"
    role="region"
    aria-labelledby="header-2"
  >
    Content for section 2
  </div>
</div>
```

```javascript
// Toggle panel visibility
function togglePanel(button, panel) {
  const isExpanded = button.getAttribute('aria-expanded') === 'true'
  button.setAttribute('aria-expanded', !isExpanded)
  panel.hidden = isExpanded
  
  // If single-expand mode, close other panels
  if (!isExpanded && accordion.dataset.singleExpand === 'true') {
    closeOtherPanels(button)
  }
}

// Keyboard navigation
accordion.addEventListener('keydown', (e) => {
  const header = e.target.closest('[role="button"]')
  if (!header) return
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      focusNextHeader(header)
      break
    case 'ArrowUp':
      e.preventDefault()
      focusPreviousHeader(header)
      break
    case 'Home':
      e.preventDefault()
      focusFirstHeader()
      break
    case 'End':
      e.preventDefault()
      focusLastHeader()
      break
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, accordions are implemented as **bElements** because they require complex state management. Accordion headers use button **Functional Templates (FT)** as defined in stories, but the accordion container itself is a bElement that manages panel state and keyboard navigation.

#### Accordion Header Button (Functional Template)

```typescript
// button.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const AccordionHeaderButton: FT<{
  'aria-expanded': 'true' | 'false'
  'aria-controls': string
  id: string
  children?: Children
}> = ({
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
  id,
  children,
  ...attrs
}) => (
  <button
    type='button'
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
    id={id}
    {...attrs}
    {...joinStyles(buttonStyles.accordionHeader)}
  >
    {children}
  </button>
)
```

#### Accordion bElement

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'
import { AccordionHeaderButton } from './button.stories.tsx'

const accordionStyles = createStyles({
  accordion: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  header: {
    margin: 0,
  },
  panel: {
    padding: '1rem',
    display: {
      $default: 'none',
      '[aria-expanded="true"] + &': 'block',
    },
  },
  panelHidden: {
    display: 'none',
  },
})

type AccordionEvents = {
  toggle: { panelId: string; expanded: boolean }
}

export const Accordion = bElement<AccordionEvents>({
  tag: 'accessible-accordion',
  observedAttributes: ['single-expand'],
  shadowDom: (
    <div {...accordionStyles.accordion}>
      <slot name='panels'></slot>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const accordion = $('accordion')[0]
    let headers: HTMLButtonElement[] = []
    let panels: HTMLElement[] = []
    const singleExpand = host.hasAttribute('single-expand')

    const updatePanelVisibility = (header: HTMLButtonElement, panel: HTMLElement, expanded: boolean) => {
      header.attr('aria-expanded', expanded ? 'true' : 'false')
      if (expanded) {
        panel.attr('hidden', null)
      } else {
        panel.attr('hidden', '')
      }
    }

    const closeOtherPanels = (currentHeader: HTMLButtonElement) => {
      headers.forEach((header) => {
        if (header !== currentHeader) {
          const panelId = header.attr('aria-controls')
          const panel = panels.find((p) => p.id === panelId)
          if (panel) {
            updatePanelVisibility(header, panel, false)
          }
        }
      })
    }

    const focusNextHeader = (currentHeader: HTMLButtonElement) => {
      const currentIndex = headers.indexOf(currentHeader)
      const nextIndex = (currentIndex + 1) % headers.length
      headers[nextIndex]?.focus()
    }

    const focusPreviousHeader = (currentHeader: HTMLButtonElement) => {
      const currentIndex = headers.indexOf(currentHeader)
      const prevIndex = currentIndex === 0 ? headers.length - 1 : currentIndex - 1
      headers[prevIndex]?.focus()
    }

    const focusFirstHeader = () => {
      headers[0]?.focus()
    }

    const focusLastHeader = () => {
      headers[headers.length - 1]?.focus()
    }

    return {
      togglePanel(event: { type: string; target: HTMLButtonElement }) {
        const header = event.target
        const panelId = header.attr('aria-controls')
        const panel = panels.find((p) => p.id === panelId)
        if (!panel) return

        const isExpanded = header.attr('aria-expanded') === 'true'
        const newExpanded = !isExpanded

        // If single-expand mode and expanding, close others first
        if (newExpanded && singleExpand) {
          closeOtherPanels(header)
        }

        updatePanelVisibility(header, panel, newExpanded)
        emit({ type: 'toggle', detail: { panelId, expanded: newExpanded } })
      },
      handleKeydown(event: KeyboardEvent) {
        const header = event.target as HTMLButtonElement
        if (!headers.includes(header)) return

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            focusNextHeader(header)
            break
          case 'ArrowUp':
            event.preventDefault()
            focusPreviousHeader(header)
            break
          case 'Home':
            event.preventDefault()
            focusFirstHeader()
            break
          case 'End':
            event.preventDefault()
            focusLastHeader()
            break
        }
      },
      onConnected() {
        // Initialize headers and panels from slotted content
        const slot = accordion?.querySelector('slot[name="panels"]') as HTMLSlotElement
        if (!slot) return

        const assignedNodes = slot.assignedNodes()
        headers = []
        panels = []

        assignedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            const header = element.querySelector('button[aria-expanded]')
            const panel = element.querySelector('[role="region"]') || element.querySelector('[id]')
            
            if (header && panel) {
              headers.push(header as HTMLButtonElement)
              panels.push(panel as HTMLElement)
              
              // Set up click handler
              header.setAttribute('p-trigger', JSON.stringify({ click: 'togglePanel' }))
              header.setAttribute('p-target', `header-${headers.length - 1}`)
            }
          }
        })
      },
    }
  },
})
```

#### Simplified Accordion with Slots

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const accordionStyles = createStyles({
  accordion: {
    display: 'flex',
    flexDirection: 'column',
  },
  panel: {
    borderBottom: '1px solid #ccc',
  },
  headerButton: {
    width: '100%',
    padding: '1rem',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    padding: '0 1rem 1rem',
    display: {
      $default: 'none',
      '[aria-expanded="true"] + &': 'block',
    },
  },
})

type AccordionItemEvents = {
  toggle: { expanded: boolean }
}

export const AccordionItem = bElement<AccordionItemEvents>({
  tag: 'accordion-item',
  shadowDom: (
    <div {...accordionStyles.panel}>
      <button
        type='button'
        p-target='header'
        p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
        aria-expanded='false'
        aria-controls='panel-content'
        {...accordionStyles.headerButton}
      >
        <slot name='header'></slot>
        <span aria-hidden='true'>▼</span>
      </button>
      <div
        p-target='content'
        id='panel-content'
        role='region'
        hidden
        {...accordionStyles.content}
      >
        <slot name='content'></slot>
      </div>
    </div>
  ),
  bProgram({ $, emit }) {
    const header = $<HTMLButtonElement>('header')[0]
    const content = $('content')[0]
    let expanded = false

    return {
      toggle() {
        expanded = !expanded
        header?.attr('aria-expanded', expanded ? 'true' : 'false')
        if (expanded) {
          content?.attr('hidden', null)
        } else {
          content?.attr('hidden', '')
        }
        emit({ type: 'toggle', detail: { expanded } })
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          header?.click()
        }
      },
    }
  },
})

// Container accordion for coordinating multiple items
export const Accordion = bElement({
  tag: 'accessible-accordion',
  observedAttributes: ['single-expand'],
  shadowDom: (
    <div {...accordionStyles.accordion}>
      <slot></slot>
    </div>
  ),
  bProgram({ $, host }) {
    const accordion = $('accordion')[0]
    let items: HTMLElement[] = []
    const singleExpand = host.hasAttribute('single-expand')

    return {
      itemToggled(event: CustomEvent) {
        if (!singleExpand) return

        const expanded = event.detail.expanded
        if (expanded) {
          // Close other items
          items.forEach((item) => {
            if (item !== event.target) {
              const itemElement = item as any
              const header = itemElement.shadowRoot?.querySelector('button[aria-expanded="true"]')
              if (header) {
                header.click()
              }
            }
          })
        }
      },
      onConnected() {
        // Listen for toggle events from accordion items
        const slot = accordion?.querySelector('slot') as HTMLSlotElement
        if (!slot) return

        slot.addEventListener('slotchange', () => {
          const assignedNodes = slot.assignedElements()
          items = assignedNodes.filter((node) => node.tagName === 'ACCORDION-ITEM')
          
          items.forEach((item) => {
            item.addEventListener('toggle', (e) => {
              // Handle single-expand coordination
            })
          })
        })
      },
    }
  },
})
```

#### Usage Example

```typescript
// In a story or template
<Accordion single-expand>
  <AccordionItem>
    <span slot='header'>Section 1</span>
    <div slot='content'>Content for section 1</div>
  </AccordionItem>
  <AccordionItem>
    <span slot='header'>Section 2</span>
    <div slot='content'>Content for section 2</div>
  </AccordionItem>
  <AccordionItem>
    <span slot='header'>Section 3</span>
    <div slot='content'>Content for section 3</div>
  </AccordionItem>
</Accordion>
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - accordion is a bElement with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for declarative event binding (click, keydown)
  - `p-target` for element selection with `$()`
  - `attr()` helper for ARIA attribute management
  - `observedAttributes` for reactive attribute changes (single-expand mode)
  - Slots for content distribution
- **Requires external web API**: No - uses standard HTML elements and ARIA
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

- **Enter or Space**: 
  - When focus is on a collapsed panel header, expands the associated panel
  - When focus is on an expanded panel header, collapses the panel (if collapse is supported)
  - In single-expand mode, collapses other expanded panels when expanding a new one
- **Tab**: Moves focus to the next focusable element
- **Shift + Tab**: Moves focus to the previous focusable element
- **Down Arrow** (Optional): Moves focus to the next accordion header
- **Up Arrow** (Optional): Moves focus to the previous accordion header
- **Home** (Optional): Moves focus to the first accordion header
- **End** (Optional): Moves focus to the last accordion header

## WAI-ARIA Roles, States, and Properties

### Required

- **role="button"**: Accordion header button (implicit on `<button>` element)
- **role="heading"**: Wrapper around accordion header button with appropriate `aria-level`
- **aria-expanded**: Set to `true` when panel is visible, `false` when hidden
- **aria-controls**: ID reference to the element containing the accordion panel content

### Optional

- **role="region"**: On panel container (use sparingly to avoid landmark proliferation)
- **aria-labelledby**: On panel container, references the button that controls it
- **aria-disabled**: Set to `true` on header button if panel cannot be collapsed (when one panel must always be expanded)
- **aria-level**: On heading element wrapping the button (appropriate for page structure)

## Best Practices

1. **Use native `<button>` elements** for accordion headers - they provide built-in keyboard support
2. **Implement as bElement** - accordions require complex state management for panel visibility and keyboard navigation
3. **Support single-expand mode** - allow attribute `single-expand` to enforce only one panel open at a time
4. **Use semantic HTML** - wrap buttons in heading elements with appropriate `aria-level`
5. **Provide visual indicators** - show expanded/collapsed state with icons or styling
6. **Handle focus management** - ensure keyboard navigation works smoothly between headers
7. **Use slots for content** - allow flexible content distribution via named slots
8. **Avoid excessive regions** - only use `role="region"` when panels contain headings or nested structures

## Accessibility Considerations

- Screen readers announce button role, label, and expanded state
- Keyboard users can navigate between headers and activate panels
- Focus indicators must be visible on accordion headers
- Visual state (expanded/collapsed) should be clear and consistent
- Panel content should be properly associated with headers via `aria-controls`
- In single-expand mode, screen readers should announce when other panels close

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: Native HTML elements and ARIA attributes have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
- MDN: [ARIA region role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/region_role)
