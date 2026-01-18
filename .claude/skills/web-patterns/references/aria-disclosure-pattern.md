# ARIA Disclosure (Show/Hide) Pattern

## Overview

A disclosure is a widget that enables content to be either collapsed (hidden) or expanded (visible). It has two elements, a disclosure button and a section of content whose visibility is controlled by the button. When the controlled content is hidden the button is often styled as a typical push button with a right-pointing arrow or triangle to hint that activating the button will display additional content. When the content is visible, the arrow or triangle typically points down.

**Key Characteristics:**

- **Simple toggle**: Single button controls single content section
- **Two states**: Expanded (visible) or collapsed (hidden)
- **Visual indicator**: Arrow/triangle changes direction based on state
- **Keyboard accessible**: Enter and Space activate the button

**Differences from Accordion:**

- Disclosure is a single item (one button, one content section)
- Accordion is a group of multiple disclosures
- Disclosure doesn't need keyboard navigation between items
- Simpler implementation and state management

## Use Cases

- FAQ answers that expand on click
- Image descriptions that can be shown/hidden
- Additional details or metadata
- Navigation menus with collapsible sections
- Card content that expands to show more
- Help text or tooltips
- Collapsible form sections

## Implementation

### Vanilla JavaScript

```html
<button 
  type="button"
  aria-expanded="false"
  aria-controls="disclosure-content"
  id="disclosure-button"
>
  Show Details
  <span aria-hidden="true">▶</span>
</button>
<div 
  id="disclosure-content"
  hidden
>
  Additional content that can be shown or hidden.
</div>
```

```javascript
// Toggle disclosure
function toggleDisclosure(button, content) {
  const isExpanded = button.getAttribute('aria-expanded') === 'true'
  const newExpanded = !isExpanded
  
  button.setAttribute('aria-expanded', newExpanded)
  content.hidden = !newExpanded
  
  // Update arrow indicator
  const arrow = button.querySelector('[aria-hidden="true"]')
  arrow.textContent = newExpanded ? '▼' : '▶'
}

// Handle keyboard
button.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleDisclosure(button, content)
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, disclosures can be implemented as:

1. **Functional Templates (FT)** for static disclosures in stories
2. **bElements** for dynamic disclosures that need state management

#### Static Disclosure (Functional Template)

```typescript
// disclosure.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { disclosureStyles } from './disclosure.css.ts'

const DisclosureButton: FT<{
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
    {...attrs}
    {...joinStyles(
      disclosureStyles.button,
      ariaExpanded === 'true' && disclosureStyles.expanded
    )}
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
    id={id}
  >
    {children}
    <span
      aria-hidden='true'
      {...disclosureStyles.arrow}
    >
      {ariaExpanded === 'true' ? '▼' : '▶'}
    </span>
  </button>
)

const DisclosureContent: FT<{
  id: string
  hidden?: boolean
  children?: Children
}> = ({ id, hidden, children, ...attrs }) => (
  <div
    id={id}
    hidden={hidden}
    {...attrs}
    {...joinStyles(disclosureStyles.content)}
  >
    {children}
  </div>
)

export const disclosureStory = story({
  intent: 'Display a disclosure with expandable content',
  template: () => (
    <>
      <DisclosureButton
        id='disclosure-button'
        aria-expanded='false'
        aria-controls='disclosure-content'
      >
        Show Details
      </DisclosureButton>
      <DisclosureContent
        id='disclosure-content'
        hidden
      >
        This is the additional content that can be shown or hidden.
      </DisclosureContent>
    </>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

#### Dynamic Disclosure (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const disclosureStyles = createStyles({
  disclosure: {
    display: 'block',
  },
  button: {
    inlineSize: '100%',
    padding: '0.75rem',
    textAlign: 'left',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
  arrow: {
    fontSize: '0.75rem',
    transition: 'transform 0.2s',
    transform: {
      $default: 'rotate(0deg)',
      '[aria-expanded="true"] + * &': 'rotate(90deg)',
    },
  },
  content: {
    padding: '1rem',
    marginTop: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    display: {
      $default: 'none',
      '[data-expanded="true"]': 'block',
    },
  },
})

type DisclosureEvents = {
  toggle: { expanded: boolean }
}

export const Disclosure = bElement<DisclosureEvents>({
  tag: 'disclosure-widget',
  observedAttributes: ['expanded'],
  shadowDom: (
    <div
      p-target='disclosure'
      {...disclosureStyles.disclosure}
    >
      <button
        type='button'
        p-target='button'
        aria-expanded='false'
        aria-controls='disclosure-content'
        {...disclosureStyles.button}
        p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
      >
        <span>
          <slot name='button-label'>Show Details</slot>
        </span>
        <span
          p-target='arrow'
          aria-hidden='true'
          {...disclosureStyles.arrow}
        >
          ▶
        </span>
      </button>
      <div
        p-target='content'
        id='disclosure-content'
        data-expanded='false'
        {...disclosureStyles.content}
      >
        <slot name='content'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const button = $<HTMLButtonElement>('button')[0]
    const content = $('content')[0]
    const arrow = $('arrow')[0]
    let expanded = false

    const updateState = (newExpanded: boolean) => {
      expanded = newExpanded
      button?.attr('aria-expanded', expanded ? 'true' : 'false')
      content?.attr('data-expanded', expanded ? 'true' : 'false')
      content?.attr('hidden', expanded ? null : '')
      
      // Update arrow
      if (arrow) {
        arrow.render(expanded ? '▼' : '▶')
      }
      
      // Update host attribute
      if (expanded) {
        host.setAttribute('expanded', '')
      } else {
        host.removeAttribute('expanded')
      }
      
      emit({ type: 'toggle', detail: { expanded } })
    }

    return {
      toggle() {
        updateState(!expanded)
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          button?.click()
        }
      },
      onConnected() {
        // Initialize from attribute
        if (host.hasAttribute('expanded')) {
          expanded = true
          updateState(true)
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'expanded') {
          const shouldBeExpanded = newValue !== null
          if (shouldBeExpanded !== expanded) {
            updateState(shouldBeExpanded)
          }
        }
      },
    }
  },
})
```

#### Disclosure with Native `<details>` Element

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const detailsStyles = createStyles({
  details: {
    display: 'block',
  },
  summary: {
    padding: '0.75rem',
    cursor: 'pointer',
    listStyle: 'none',
    userSelect: 'none',
  },
  content: {
    padding: '1rem',
    marginTop: '0.5rem',
  },
})

type DetailsDisclosureEvents = {
  toggle: { open: boolean }
}

export const DetailsDisclosure = bElement<DetailsDisclosureEvents>({
  tag: 'details-disclosure',
  observedAttributes: ['open'],
  shadowDom: (
    <details
      p-target='details'
      {...detailsStyles.details}
      p-trigger={{ toggle: 'handleToggle' }}
    >
      <summary
        p-target='summary'
        {...detailsStyles.summary}
      >
        <slot name='summary'>Show Details</slot>
      </summary>
      <div
        p-target='content'
        {...detailsStyles.content}
      >
        <slot name='content'></slot>
      </div>
    </details>
  ),
  bProgram({ $, host, emit }) {
    const details = $<HTMLDetailsElement>('details')[0]

    return {
      handleToggle() {
        const isOpen = details?.open || false
        if (isOpen) {
          host.setAttribute('open', '')
        } else {
          host.removeAttribute('open')
        }
        emit({ type: 'toggle', detail: { open: isOpen } })
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'open' && details) {
          details.open = newValue !== null
        }
      },
      onConnected() {
        // Initialize from attribute
        if (host.hasAttribute('open') && details) {
          details.open = true
        }
      },
    }
  },
})
```

#### Disclosure Group (Multiple Disclosures)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'
import { Disclosure } from './disclosure'

const groupStyles = createStyles({
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
})

type DisclosureGroupEvents = {
  itemToggle: { id: string; expanded: boolean }
}

export const DisclosureGroup = bElement<DisclosureGroupEvents>({
  tag: 'disclosure-group',
  shadowDom: (
    <div
      p-target='group'
      {...groupStyles.group}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $, emit }) {
    const group = $('group')[0]

    return {
      handleItemToggle(event: CustomEvent) {
        // Forward toggle events from child disclosures
        emit({
          type: 'itemToggle',
          detail: {
            id: (event.target as HTMLElement).id,
            expanded: event.detail.expanded,
          },
        })
      },
      onConnected() {
        // Listen for toggle events from child disclosures
        const slot = group?.querySelector('slot') as HTMLSlotElement
        if (slot) {
          slot.addEventListener('slotchange', () => {
            const assignedNodes = slot.assignedElements()
            assignedNodes.forEach((node) => {
              if (node.tagName === 'DISCLOSURE-WIDGET') {
                node.addEventListener('toggle', (e) => {
                  // Handle child disclosure toggle
                })
              }
            })
          })
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Optional - disclosures can be FT (no Shadow DOM) or bElements (with Shadow DOM)
- **Uses bElement built-ins** (if using bElement):
  - `p-trigger` for button clicks and keyboard events
  - `p-target` for element selection with `$()`
  - `attr()` helper for managing ARIA attributes and visibility
  - `render()` helper for updating arrow indicator
  - `observedAttributes` for reactive updates
- **Requires external web API**: 
  - Native `<details>` element (if using native implementation)
  - Keyboard event handling
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

- **Enter**: Activates the disclosure button and toggles content visibility
- **Space**: Activates the disclosure button and toggles content visibility
- **Tab**: Moves focus to next focusable element
- **Shift + Tab**: Moves focus to previous focusable element

**Note**: Native `<button>` elements handle Enter and Space automatically. The `handleKeydown` handler is only needed for additional keyboard logic or custom elements.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="button"**: On the disclosure control (implicit on `<button>` element)
- **aria-expanded**: Set to `"true"` when content is visible, `"false"` when hidden

### Optional

- **aria-controls**: ID reference to the element containing the disclosure content
- **aria-hidden="true"**: On visual indicators (arrows, icons) that don't need to be announced

## Best Practices

1. **Use Functional Templates** for static disclosures in stories
2. **Use bElements** for dynamic disclosures that need state management
3. **Consider native `<details>`** - Provides built-in disclosure behavior
4. **Provide visual indicators** - Use arrows or icons that change with state
5. **Hide decorative elements** - Use `aria-hidden="true"` on arrows/icons
6. **Use semantic HTML** - Prefer native `<details>` and `<summary>` when possible
7. **Label clearly** - Button text should indicate what will be shown/hidden
8. **Update button text** - Optionally change button label based on state (e.g., "Show" → "Hide")
9. **Animate transitions** - Use CSS transitions for smooth expand/collapse

## Accessibility Considerations

- Screen readers announce button role, label, and expanded state
- Keyboard users can activate with Enter or Space
- Visual state (expanded/collapsed) should be clear and consistent
- Arrow indicators help users understand the control's function
- Content should be properly associated with button via `aria-controls`
- Hidden content is not announced by screen readers until expanded

## Differences from Accordion

| Feature | Disclosure | Accordion |
|---------|------------|-----------|
| Number of items | Single | Multiple |
| Keyboard navigation | Tab only | Arrow keys, Home, End |
| State management | Simple toggle | Multiple panels, single-expand mode |
| Use case | Single expandable section | Grouped related sections |
| Complexity | Simple | More complex |

## Native `<details>` Element

The native HTML `<details>` element provides built-in disclosure behavior:

```html
<details>
  <summary>Show Details</summary>
  <p>Content that can be shown or hidden.</p>
</details>
```

**Advantages:**

- Built-in keyboard support
- No JavaScript required
- Automatic ARIA attributes
- Browser-native behavior

**Considerations:**

- Less styling control
- Limited customization options
- May not work in all use cases

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<details>` since v12) |
| Firefox | Full support (native `<details>` since v49) |
| Safari | Full support (native `<details>` since v6) |
| Edge | Full support (native `<details>` since v79) |

**Note**: Native HTML elements and ARIA attributes have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- Related: [Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- MDN: [HTML details element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
