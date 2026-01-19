# ARIA Accordion Pattern

## Overview

An accordion is a vertically stacked set of interactive headings. Each contain a title, content snippet, or thumbnail representing a section of content. The headings function as controls that enable users to reveal or hide their associated sections of content. Accordions are commonly used to reduce the need to scroll when presenting multiple sections of content on a single page.

**Key Terms:**

- **Accordion Header**: Label or thumbnail representing a section that serves as a control for showing/hiding content
- **Accordion Panel**: Section of content associated with an accordion header

## Use Cases

- Organizing form sections when only one section should be shown at a time
- FAQ sections with expandable answers
- Navigation menus with collapsible sections
- Content organization to reduce scrolling
- Settings panels with grouped options
- Multi-step wizards or processes

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

**File Structure:**

```
accordion/
  accordion.css.ts        # Styles (createStyles) - ALWAYS separate
  accordion.stories.tsx   # bElement + stories (imports from css.ts)
```

#### accordion.css.ts

```typescript
// accordion.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  accordion: {
    display: 'flex',
    flexDirection: 'column',
  },
  item: {
    borderBlockEnd: '1px solid #ccc',
  },
  header: {
    inlineSize: '100%',
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
  },
  icon: {
    transition: 'transform 0.2s',
  },
  iconExpanded: {
    transform: 'rotate(180deg)',
  },
})
```

#### accordion.stories.tsx

```typescript
// accordion.stories.tsx
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './accordion.css.ts'

// bElement - defined locally, NOT exported
const AccordionItem = bElement({
  tag: 'pattern-accordion-item',
  shadowDom: (
    <div p-target="item" {...styles.item}>
      <button
        type="button"
        p-target="header"
        p-trigger={{ click: 'toggle' }}
        aria-expanded="false"
        aria-controls="panel-content"
        {...styles.header}
      >
        <slot name="header"></slot>
        <span p-target="icon" aria-hidden="true" {...styles.icon}>▼</span>
      </button>
      <div
        p-target="content"
        id="panel-content"
        role="region"
        hidden
        {...styles.content}
      >
        <slot name="content"></slot>
      </div>
    </div>
  ),
  bProgram({ $, emit }) {
    return {
      toggle() {
        const header = $('header')[0]
        const content = $('content')[0]
        const icon = $('icon')[0]

        const isExpanded = header?.attr('aria-expanded') === 'true'
        const newExpanded = !isExpanded

        header?.attr('aria-expanded', newExpanded ? 'true' : 'false')
        content?.attr('hidden', newExpanded ? null : '')

        // Visual feedback for icon rotation
        if (newExpanded) {
          icon?.attr('class', `${styles.icon.classNames.join(' ')} ${styles.iconExpanded.classNames.join(' ')}`)
        } else {
          icon?.attr('class', styles.icon.classNames.join(' '))
        }

        emit({ type: 'toggle', detail: { expanded: newExpanded } })
      },
    }
  },
})

// Container accordion for coordinating multiple items (single-expand mode)
const Accordion = bElement({
  tag: 'pattern-accordion',
  observedAttributes: ['single-expand'],
  shadowDom: (
    <div p-target="accordion" {...styles.accordion}>
      <slot p-target="slot"></slot>
    </div>
  ),
  bProgram({ $, host, trigger }) {
    const singleExpand = host.hasAttribute('single-expand')

    return {
      onConnected() {
        if (!singleExpand) return

        // Listen for toggle events from accordion items
        const slot = $('slot')[0]
        const slotElement = slot?.root.querySelector('slot') as HTMLSlotElement
        if (!slotElement) return

        slotElement.addEventListener('slotchange', () => {
          const items = slotElement.assignedElements()

          items.forEach((item) => {
            item.addEventListener('toggle', ((e: CustomEvent) => {
              if (e.detail.expanded) {
                // Close other items by triggering their collapse
                items.forEach((otherItem) => {
                  if (otherItem !== item) {
                    trigger({ type: 'collapseItem', detail: { item: otherItem } })
                  }
                })
              }
            }) as EventListener)
          })
        })
      },
      collapseItem({ detail }: { detail: { item: Element } }) {
        // Use emit to communicate with child - child listens and collapses if expanded
        const item = detail.item as HTMLElement
        item.dispatchEvent(new CustomEvent('requestCollapse'))
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const defaultAccordion = story({
  intent: 'Demonstrates basic accordion with multiple expandable sections',
  template: () => (
    <Accordion>
      <AccordionItem>
        <span slot="header">Section 1</span>
        <div slot="content">Content for section 1. This panel can be expanded independently.</div>
      </AccordionItem>
      <AccordionItem>
        <span slot="header">Section 2</span>
        <div slot="content">Content for section 2. Multiple panels can be open at once.</div>
      </AccordionItem>
      <AccordionItem>
        <span slot="header">Section 3</span>
        <div slot="content">Content for section 3. Click any header to toggle its panel.</div>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const header1 = await findByAttribute('p-target', 'header')
    const content1 = await findByAttribute('p-target', 'content')

    assert({
      given: 'accordion is rendered',
      should: 'have first panel collapsed initially',
      actual: content1?.hasAttribute('hidden'),
      expected: true,
    })

    assert({
      given: 'accordion is rendered',
      should: 'have aria-expanded set to false',
      actual: header1?.getAttribute('aria-expanded'),
      expected: 'false',
    })

    if (header1) await fireEvent(header1, 'click')

    assert({
      given: 'header is clicked',
      should: 'expand the panel',
      actual: content1?.hasAttribute('hidden'),
      expected: false,
    })

    assert({
      given: 'header is clicked',
      should: 'update aria-expanded to true',
      actual: header1?.getAttribute('aria-expanded'),
      expected: 'true',
    })
  },
})

export const singleExpandAccordion = story({
  intent: 'Demonstrates accordion with single-expand mode where only one panel can be open',
  template: () => (
    <Accordion single-expand>
      <AccordionItem>
        <span slot="header">FAQ Question 1</span>
        <div slot="content">Answer to question 1. When you open another section, this one closes.</div>
      </AccordionItem>
      <AccordionItem>
        <span slot="header">FAQ Question 2</span>
        <div slot="content">Answer to question 2. Only one panel can be open at a time.</div>
      </AccordionItem>
      <AccordionItem>
        <span slot="header">FAQ Question 3</span>
        <div slot="content">Answer to question 3. This is useful for FAQ sections.</div>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - accordion is a bElement with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `trigger`, `attr`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

- **Enter or Space**: When focus is on a collapsed panel header, expands the associated panel. When focus is on an expanded panel header, collapses the panel.
- **Tab**: Moves focus to the next focusable element
- **Shift + Tab**: Moves focus to the previous focusable element
- **Down Arrow** (Optional): Moves focus to the next accordion header
- **Up Arrow** (Optional): Moves focus to the previous accordion header
- **Home** (Optional): Moves focus to the first accordion header
- **End** (Optional): Moves focus to the last accordion header

**Note**: Native `<button>` elements handle Enter and Space automatically. No additional keyboard handlers needed for toggle functionality.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="button"**: Accordion header button (implicit on `<button>` element)
- **aria-expanded**: Set to `true` when panel is visible, `false` when hidden
- **aria-controls**: ID reference to the element containing the accordion panel content

### Optional

- **role="region"**: On panel container (use sparingly to avoid landmark proliferation)
- **aria-labelledby**: On panel container, references the button that controls it
- **aria-disabled**: Set to `true` on header button if panel cannot be collapsed

## Best Practices

1. **Use native `<button>` elements** for accordion headers - they provide built-in keyboard support
2. **Use static `p-trigger`** in the template - never add p-trigger dynamically
3. **Use `emit()` for parent communication** - never reach into child shadowRoot
4. **Support single-expand mode** via `single-expand` attribute
5. **Use slots for content** - allow flexible content distribution
6. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce button role, label, and expanded state
- Keyboard users can navigate between headers and activate panels
- Focus indicators must be visible on accordion headers
- Visual state (expanded/collapsed) should be clear and consistent
- Panel content should be properly associated with headers via `aria-controls`

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
- MDN: [ARIA region role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/region_role)
