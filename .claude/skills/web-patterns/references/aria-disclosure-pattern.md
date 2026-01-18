# ARIA Disclosure (Show/Hide) Pattern

## Overview

A disclosure is a widget that enables content to be either collapsed (hidden) or expanded (visible). It has two elements: a disclosure button and a section of content whose visibility is controlled by the button.

**Key Characteristics:**

- **Simple toggle**: Single button controls single content section
- **Two states**: Expanded (visible) or collapsed (hidden)
- **Visual indicator**: Arrow/triangle changes direction based on state
- **Keyboard accessible**: Enter and Space activate the button

**Native HTML First:** Consider using the native `<details>` and `<summary>` elements which provide built-in keyboard support and accessibility. Use custom disclosures only when you need styling or behavior beyond CSS capabilities.

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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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
<div id="disclosure-content" hidden>
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
```

### Plaited Adaptation

**File Structure:**

```
disclosure/
  disclosure.css.ts        # Styles (createStyles) - ALWAYS separate
  disclosure.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### disclosure.css.ts

```typescript
// disclosure.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
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
  buttonExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  arrow: {
    fontSize: '0.75rem',
    transition: 'transform 0.2s',
  },
  arrowExpanded: {
    transform: 'rotate(90deg)',
  },
  content: {
    padding: '1rem',
    border: '1px solid #ccc',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
  },
  label: {
    userSelect: 'none',
  },
})

// Native details element styles
export const detailsStyles = createStyles({
  details: {
    display: 'block',
  },
  summary: {
    padding: '0.75rem',
    cursor: 'pointer',
    listStyle: 'none',
    userSelect: 'none',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  summaryOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  content: {
    padding: '1rem',
    border: '1px solid #ccc',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
  },
})
```

#### disclosure.stories.tsx

```typescript
// disclosure.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, detailsStyles, hostStyles } from './disclosure.css.ts'

// FunctionalTemplate for static disclosure - defined locally, NOT exported
const StaticDisclosure: FT<{
  expanded?: boolean
  buttonLabel?: string
  children?: Children
}> = ({ expanded = false, buttonLabel = 'Show Details', children }) => (
  <>
    <button
      type="button"
      aria-expanded={expanded ? 'true' : 'false'}
      aria-controls="disclosure-content"
      {...styles.button}
      {...(expanded ? styles.buttonExpanded : {})}
    >
      <span {...styles.label}>{buttonLabel}</span>
      <span
        aria-hidden="true"
        {...styles.arrow}
        {...(expanded ? styles.arrowExpanded : {})}
      >
        ▶
      </span>
    </button>
    <div
      id="disclosure-content"
      hidden={!expanded}
      {...(expanded ? styles.content : {})}
    >
      {children}
    </div>
  </>
)

// bElement for interactive disclosure - defined locally, NOT exported
const Disclosure = bElement({
  tag: 'pattern-disclosure',
  observedAttributes: ['expanded'],
  hostStyles,
  shadowDom: (
    <div p-target="disclosure">
      <button
        type="button"
        p-target="button"
        aria-expanded="false"
        aria-controls="disclosure-content"
        p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
        {...styles.button}
      >
        <span {...styles.label}>
          <slot name="label">Show Details</slot>
        </span>
        <span p-target="arrow" aria-hidden="true" {...styles.arrow}>▶</span>
      </button>
      <div
        p-target="content"
        id="disclosure-content"
        hidden
      >
        <div {...styles.content}>
          <slot></slot>
        </div>
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const button = $('button')[0]
    const content = $('content')[0]
    const arrow = $('arrow')[0]
    let expanded = false

    const updateState = (newExpanded: boolean) => {
      expanded = newExpanded
      button?.attr('aria-expanded', expanded ? 'true' : 'false')
      content?.attr('hidden', expanded ? null : '')

      // Update visual state
      if (expanded) {
        button?.attr('class', `${styles.button.classNames.join(' ')} ${styles.buttonExpanded.classNames.join(' ')}`)
        arrow?.attr('class', `${styles.arrow.classNames.join(' ')} ${styles.arrowExpanded.classNames.join(' ')}`)
      } else {
        button?.attr('class', styles.button.classNames.join(' '))
        arrow?.attr('class', styles.arrow.classNames.join(' '))
      }

      host.toggleAttribute('expanded', expanded)
      emit({ type: 'toggle', detail: { expanded } })
    }

    return {
      toggle() {
        updateState(!expanded)
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          updateState(!expanded)
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
      onConnected() {
        if (host.hasAttribute('expanded')) {
          updateState(true)
        }
      },
    }
  },
})

// bElement using native <details> - defined locally, NOT exported
const DetailsDisclosure = bElement({
  tag: 'pattern-details-disclosure',
  observedAttributes: ['open'],
  hostStyles,
  shadowDom: (
    <details
      p-target="details"
      p-trigger={{ toggle: 'handleToggle' }}
      {...detailsStyles.details}
    >
      <summary p-target="summary" {...detailsStyles.summary}>
        <slot name="summary">Show Details</slot>
      </summary>
      <div {...detailsStyles.content}>
        <slot></slot>
      </div>
    </details>
  ),
  bProgram({ $, host, emit }) {
    const details = $<HTMLDetailsElement>('details')[0]
    const summary = $('summary')[0]

    const updateSummaryStyle = (isOpen: boolean) => {
      if (isOpen) {
        summary?.attr('class', `${detailsStyles.summary.classNames.join(' ')} ${detailsStyles.summaryOpen.classNames.join(' ')}`)
      } else {
        summary?.attr('class', detailsStyles.summary.classNames.join(' '))
      }
    }

    return {
      handleToggle() {
        const isOpen = details?.open ?? false
        host.toggleAttribute('open', isOpen)
        updateSummaryStyle(isOpen)
        emit({ type: 'toggle', detail: { open: isOpen } })
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'open' && details) {
          details.open = newValue !== null
          updateSummaryStyle(details.open)
        }
      },
      onConnected() {
        if (host.hasAttribute('open') && details) {
          details.open = true
          updateSummaryStyle(true)
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const collapsedDisclosure = story({
  intent: 'Display a disclosure in its collapsed default state',
  template: () => (
    <Disclosure>
      <span slot="label">Show Details</span>
      This is the additional content that can be shown or hidden.
    </Disclosure>
  ),
  play: async ({ findByAttribute, assert }) => {
    const button = await findByAttribute('p-target', 'button')

    assert({
      given: 'disclosure is rendered',
      should: 'be collapsed initially',
      actual: button?.getAttribute('aria-expanded'),
      expected: 'false',
    })
  },
})

export const expandedDisclosure = story({
  intent: 'Display a disclosure in its expanded state',
  template: () => (
    <Disclosure expanded>
      <span slot="label">Hide Details</span>
      This content is visible because the disclosure is expanded.
    </Disclosure>
  ),
  play: async ({ findByAttribute, assert }) => {
    const button = await findByAttribute('p-target', 'button')

    assert({
      given: 'disclosure has expanded attribute',
      should: 'be expanded',
      actual: button?.getAttribute('aria-expanded'),
      expected: 'true',
    })
  },
})

export const toggleDisclosure = story({
  intent: 'Demonstrate disclosure toggle behavior with click interaction',
  template: () => (
    <Disclosure>
      <span slot="label">Toggle Me</span>
      Click the button to show or hide this content.
    </Disclosure>
  ),
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const button = await findByAttribute('p-target', 'button')

    assert({
      given: 'disclosure is rendered',
      should: 'be collapsed initially',
      actual: button?.getAttribute('aria-expanded'),
      expected: 'false',
    })

    if (button) await fireEvent(button, 'click')

    assert({
      given: 'disclosure button is clicked',
      should: 'become expanded',
      actual: button?.getAttribute('aria-expanded'),
      expected: 'true',
    })

    if (button) await fireEvent(button, 'click')

    assert({
      given: 'disclosure button is clicked again',
      should: 'become collapsed',
      actual: button?.getAttribute('aria-expanded'),
      expected: 'false',
    })
  },
})

export const nativeDetailsDisclosure = story({
  intent: 'Disclosure using native <details> element for built-in accessibility',
  template: () => (
    <DetailsDisclosure>
      <span slot="summary">Click to reveal</span>
      This disclosure uses the native &lt;details&gt; element for built-in keyboard support.
    </DetailsDisclosure>
  ),
  play: async ({ findByAttribute, assert }) => {
    const details = await findByAttribute('p-target', 'details')

    assert({
      given: 'native details disclosure is rendered',
      should: 'be closed initially',
      actual: (details as HTMLDetailsElement)?.open,
      expected: false,
    })
  },
})

export const staticDisclosures = story({
  intent: 'Static FunctionalTemplate disclosures for non-interactive display',
  template: () => (
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <StaticDisclosure buttonLabel="Collapsed State">
        This content is hidden.
      </StaticDisclosure>
      <StaticDisclosure expanded buttonLabel="Expanded State">
        This content is visible because expanded is true.
      </StaticDisclosure>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - interactive disclosures are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: Native `<details>` element (if using native implementation)
- **Cleanup required**: No

## Keyboard Interaction

- **Enter**: Activates the disclosure button and toggles content visibility
- **Space**: Activates the disclosure button and toggles content visibility
- **Tab**: Moves focus to next focusable element
- **Shift + Tab**: Moves focus to previous focusable element

**Note**: Native `<button>` elements handle Enter and Space automatically.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="button"**: On the disclosure control (implicit on `<button>` element)
- **aria-expanded**: Set to `"true"` when content is visible, `"false"` when hidden

### Optional

- **aria-controls**: ID reference to the element containing the disclosure content
- **aria-hidden="true"**: On visual indicators (arrows, icons) that don't need to be announced

## Best Practices

1. **Use native `<details>`** when possible - provides built-in accessibility
2. **Use FunctionalTemplates** for static display
3. **Use bElements** for dynamic disclosures that need state management
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Provide visual indicators** - Use arrows or icons that change with state
6. **Hide decorative elements** - Use `aria-hidden="true"` on arrows/icons
7. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce button role, label, and expanded state
- Keyboard users can activate with Enter or Space
- Visual state (expanded/collapsed) should be clear and consistent
- Arrow indicators help users understand the control's function
- Content should be properly associated with button via `aria-controls`
- Hidden content is not announced by screen readers until expanded

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<details>` since v12) |
| Firefox | Full support (native `<details>` since v49) |
| Safari | Full support (native `<details>` since v6) |
| Edge | Full support (native `<details>` since v79) |

## References

- Source: [W3C ARIA Authoring Practices Guide - Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- Related: [Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- MDN: [HTML details element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
