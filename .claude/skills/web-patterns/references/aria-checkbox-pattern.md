# ARIA Checkbox Pattern

## Overview

There are two types of checkboxes: dual-state checkboxes toggle between two choices (checked and not checked), and tri-state checkboxes, which allow an additional third state known as partially checked (mixed).

**Key Characteristics:**

- **Dual-state**: Checked (`true`) or unchecked (`false`)
- **Tri-state**: Checked (`true`), unchecked (`false`), or mixed (`mixed`)
- **Keyboard interaction**: Space key toggles state
- **Form association**: Can be form-associated for native form integration

**Native HTML First:** Consider using native `<input type="checkbox">` which provides built-in keyboard support and form integration. Use custom checkboxes only when you need tri-state or custom styling beyond CSS capabilities.

## Use Cases

- Form inputs (terms acceptance, preferences)
- Settings toggles
- Multi-select lists
- Select all/none functionality
- Grouped options with parent control
- Filter controls

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Native checkbox (preferred) -->
<input type="checkbox" id="terms" aria-label="Accept terms">
<label for="terms">Accept terms and conditions</label>

<!-- Custom dual-state checkbox -->
<div role="checkbox" aria-checked="false" tabindex="0" aria-label="Accept terms">
  Accept terms and conditions
</div>

<!-- Tri-state checkbox -->
<div role="checkbox" aria-checked="mixed" tabindex="0" aria-label="Select all">
  Select all
</div>
```

```javascript
// Toggle checkbox state
function toggleCheckbox(checkbox) {
  const currentState = checkbox.getAttribute('aria-checked')
  const newState = currentState === 'true' ? 'false' : 'true'
  checkbox.setAttribute('aria-checked', newState)
}

// Handle Space key
checkbox.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault()
    toggleCheckbox(e.target)
  }
})
```

### Plaited Adaptation

**File Structure:**

```
checkbox/
  checkbox.css.ts        # Styles (createStyles) - ALWAYS separate
  checkbox.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### checkbox.css.ts

```typescript
// checkbox.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'inline-block',
})

export const styles = createStyles({
  checkbox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  checkboxDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  symbol: {
    inlineSize: '18px',
    blockSize: '18px',
    border: '2px solid #333',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  symbolChecked: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  symbolMixed: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  checkmark: {
    color: 'white',
    fontSize: '12px',
    display: 'none',
  },
  checkmarkVisible: {
    display: 'block',
  },
  minus: {
    color: 'white',
    fontSize: '12px',
    display: 'none',
  },
  minusVisible: {
    display: 'block',
  },
  label: {
    userSelect: 'none',
  },
})
```

#### checkbox.stories.tsx

```typescript
// checkbox.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './checkbox.css.ts'

// FunctionalTemplate for static checkbox - defined locally, NOT exported
const StaticCheckbox: FT<{
  checked?: boolean
  mixed?: boolean
  disabled?: boolean
  'aria-label'?: string
  children?: Children
}> = ({
  checked,
  mixed,
  disabled,
  'aria-label': ariaLabel,
  children,
  ...attrs
}) => {
  const ariaChecked = mixed ? 'mixed' : checked ? 'true' : 'false'

  return (
    <div
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={ariaLabel}
      aria-disabled={disabled ? 'true' : undefined}
      tabIndex={disabled ? -1 : 0}
      {...attrs}
      {...styles.checkbox}
      {...(disabled ? styles.checkboxDisabled : {})}
    >
      <span
        {...styles.symbol}
        {...(checked ? styles.symbolChecked : {})}
        {...(mixed ? styles.symbolMixed : {})}
      >
        <span {...styles.checkmark} {...(checked && !mixed ? styles.checkmarkVisible : {})}>✓</span>
        <span {...styles.minus} {...(mixed ? styles.minusVisible : {})}>−</span>
      </span>
      <span {...styles.label}>{children}</span>
    </div>
  )
}

// bElement for interactive checkbox - defined locally, NOT exported
const Checkbox = bElement({
  tag: 'pattern-checkbox',
  observedAttributes: ['checked', 'disabled'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target="checkbox"
      role="checkbox"
      aria-checked="false"
      tabIndex={0}
      p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
      {...styles.checkbox}
    >
      <span p-target="symbol" {...styles.symbol}>
        <span p-target="checkmark" {...styles.checkmark}>✓</span>
      </span>
      <span {...styles.label}>
        <slot></slot>
      </span>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const checkbox = $('checkbox')[0]
    const symbol = $('symbol')[0]
    const checkmark = $('checkmark')[0]
    let checked = false

    const updateState = (newChecked: boolean) => {
      checked = newChecked
      checkbox?.attr('aria-checked', checked ? 'true' : 'false')

      // Update visual state
      if (checked) {
        symbol?.attr('class', `${styles.symbol.classNames.join(' ')} ${styles.symbolChecked.classNames.join(' ')}`)
        checkmark?.attr('class', `${styles.checkmark.classNames.join(' ')} ${styles.checkmarkVisible.classNames.join(' ')}`)
      } else {
        symbol?.attr('class', styles.symbol.classNames.join(' '))
        checkmark?.attr('class', styles.checkmark.classNames.join(' '))
      }

      // Update form value
      internals.setFormValue(checked ? 'on' : null)
      host.toggleAttribute('checked', checked)

      emit({ type: 'change', detail: { checked } })
    }

    return {
      toggle() {
        if (host.hasAttribute('disabled')) return
        updateState(!checked)
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === ' ' && !host.hasAttribute('disabled')) {
          event.preventDefault()
          updateState(!checked)
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          const isChecked = newValue !== null
          if (isChecked !== checked) {
            updateState(isChecked)
          }
        }
        if (name === 'disabled') {
          const isDisabled = newValue !== null
          checkbox?.attr('tabIndex', isDisabled ? '-1' : '0')
          checkbox?.attr('class', isDisabled
            ? `${styles.checkbox.classNames.join(' ')} ${styles.checkboxDisabled.classNames.join(' ')}`
            : styles.checkbox.classNames.join(' ')
          )
        }
      },
      onConnected() {
        if (host.hasAttribute('checked')) {
          updateState(true)
        }
      },
    }
  },
})

// bElement for tri-state checkbox - defined locally, NOT exported
const TriStateCheckbox = bElement({
  tag: 'pattern-tri-state-checkbox',
  observedAttributes: ['aria-checked'],
  hostStyles,
  shadowDom: (
    <div
      p-target="checkbox"
      role="checkbox"
      aria-checked="false"
      tabIndex={0}
      p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
      {...styles.checkbox}
    >
      <span p-target="symbol" {...styles.symbol}>
        <span p-target="checkmark" {...styles.checkmark}>✓</span>
        <span p-target="minus" {...styles.minus}>−</span>
      </span>
      <span {...styles.label}>
        <slot></slot>
      </span>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const checkbox = $('checkbox')[0]
    const symbol = $('symbol')[0]
    const checkmark = $('checkmark')[0]
    const minus = $('minus')[0]
    let state: 'true' | 'false' | 'mixed' = 'false'

    const updateState = (newState: 'true' | 'false' | 'mixed') => {
      state = newState
      checkbox?.attr('aria-checked', state)
      host.setAttribute('aria-checked', state)

      // Reset visual states
      symbol?.attr('class', styles.symbol.classNames.join(' '))
      checkmark?.attr('class', styles.checkmark.classNames.join(' '))
      minus?.attr('class', styles.minus.classNames.join(' '))

      // Apply new visual state
      if (state === 'true') {
        symbol?.attr('class', `${styles.symbol.classNames.join(' ')} ${styles.symbolChecked.classNames.join(' ')}`)
        checkmark?.attr('class', `${styles.checkmark.classNames.join(' ')} ${styles.checkmarkVisible.classNames.join(' ')}`)
      } else if (state === 'mixed') {
        symbol?.attr('class', `${styles.symbol.classNames.join(' ')} ${styles.symbolMixed.classNames.join(' ')}`)
        minus?.attr('class', `${styles.minus.classNames.join(' ')} ${styles.minusVisible.classNames.join(' ')}`)
      }

      emit({ type: 'stateChange', detail: { state } })
    }

    const cycleState = () => {
      if (state === 'false') {
        updateState('true')
      } else if (state === 'true') {
        updateState('false')
      } else {
        updateState('true')
      }
    }

    return {
      toggle() {
        cycleState()
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === ' ') {
          event.preventDefault()
          cycleState()
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-checked' && newValue) {
          const validStates = ['true', 'false', 'mixed'] as const
          if (validStates.includes(newValue as typeof validStates[number])) {
            updateState(newValue as 'true' | 'false' | 'mixed')
          }
        }
      },
      onConnected() {
        const initialState = host.getAttribute('aria-checked')
        if (initialState === 'true' || initialState === 'mixed') {
          updateState(initialState)
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const uncheckedCheckbox = story({
  intent: 'Display an unchecked checkbox in its default state',
  template: () => (
    <Checkbox>Accept terms and conditions</Checkbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkbox = await findByAttribute('p-target', 'checkbox')

    assert({
      given: 'checkbox is rendered',
      should: 'be unchecked initially',
      actual: checkbox?.getAttribute('aria-checked'),
      expected: 'false',
    })
  },
})

export const checkedCheckbox = story({
  intent: 'Display a checkbox in its checked state',
  template: () => (
    <Checkbox checked>Remember me</Checkbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkbox = await findByAttribute('p-target', 'checkbox')

    assert({
      given: 'checkbox has checked attribute',
      should: 'be checked',
      actual: checkbox?.getAttribute('aria-checked'),
      expected: 'true',
    })
  },
})

export const disabledCheckbox = story({
  intent: 'Display a disabled checkbox that cannot be toggled',
  template: () => (
    <Checkbox disabled>Unavailable option</Checkbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkbox = await findByAttribute('p-target', 'checkbox')

    assert({
      given: 'checkbox is disabled',
      should: 'have tabIndex -1',
      actual: checkbox?.getAttribute('tabIndex'),
      expected: '-1',
    })
  },
})

export const toggleCheckbox = story({
  intent: 'Demonstrate checkbox toggle behavior with click interaction',
  template: () => (
    <Checkbox>Click to toggle</Checkbox>
  ),
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const checkbox = await findByAttribute('p-target', 'checkbox')

    assert({
      given: 'checkbox is rendered',
      should: 'be unchecked initially',
      actual: checkbox?.getAttribute('aria-checked'),
      expected: 'false',
    })

    if (checkbox) await fireEvent(checkbox, 'click')

    assert({
      given: 'checkbox is clicked',
      should: 'become checked',
      actual: checkbox?.getAttribute('aria-checked'),
      expected: 'true',
    })

    if (checkbox) await fireEvent(checkbox, 'click')

    assert({
      given: 'checkbox is clicked again',
      should: 'become unchecked',
      actual: checkbox?.getAttribute('aria-checked'),
      expected: 'false',
    })
  },
})

export const triStateCheckbox = story({
  intent: 'Tri-state checkbox for select-all functionality with mixed state',
  template: () => (
    <TriStateCheckbox aria-checked="mixed">Select all items</TriStateCheckbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkbox = await findByAttribute('p-target', 'checkbox')

    assert({
      given: 'tri-state checkbox is rendered with mixed',
      should: 'have aria-checked="mixed"',
      actual: checkbox?.getAttribute('aria-checked'),
      expected: 'mixed',
    })
  },
})

export const staticCheckboxes = story({
  intent: 'Static FunctionalTemplate checkboxes for non-interactive display',
  template: () => (
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <StaticCheckbox checked={false}>Unchecked</StaticCheckbox>
      <StaticCheckbox checked>Checked</StaticCheckbox>
      <StaticCheckbox mixed>Mixed (partial selection)</StaticCheckbox>
      <StaticCheckbox disabled>Disabled</StaticCheckbox>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - form-associated checkboxes are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

- **Space**: Toggles checkbox state
- **Tab**: Moves focus to next focusable element
- **Shift + Tab**: Moves focus to previous focusable element

**Note**: Native `<input type="checkbox">` handles Space automatically.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="checkbox"**: Identifies the element as a checkbox
- **aria-checked**: `"true"`, `"false"`, or `"mixed"`
- **Accessible label**: Via text content, `aria-label`, or `aria-labelledby`

### Optional

- **aria-disabled**: `"true"` when checkbox is disabled
- **tabindex="0"**: For custom checkbox elements
- **role="group"**: Container for checkbox groups

## Best Practices

1. **Use native `<input type="checkbox">`** when possible
2. **Use FunctionalTemplates** for static display
3. **Use bElements** for interactive or form-associated checkboxes
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Handle Space key** - essential for keyboard accessibility
6. **Use `$()` with `p-target`** - never use `querySelector` directly
7. **Use `formAssociated: true`** for form integration

## Accessibility Considerations

- Screen readers announce checkbox role, label, and state
- Keyboard users can toggle with Space key
- Tri-state checkboxes announce "partially checked" or "mixed"
- Focus indicators must be visible
- Disabled checkboxes should be clearly distinguishable

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
- MDN: [HTML input checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox)
- MDN: [ARIA checkbox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/checkbox_role)
