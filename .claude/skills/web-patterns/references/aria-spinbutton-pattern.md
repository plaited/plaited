# ARIA Spinbutton Pattern

## Overview

A spinbutton is an input widget that restricts its value to a set or range of discrete values. For example, in a widget that enables users to set an alarm, a spinbutton could allow users to select a number from 0 to 59 for the minute of an hour.

**Key Characteristics:**

- **Discrete values**: Restricts value to a set or range
- **Text field**: Displays current value, usually the only focusable element
- **Increase/decrease buttons**: Visual buttons (keyboard accessible via arrow keys)
- **Direct editing**: Text field allows users to directly edit the value
- **Step values**: Can support small steps (Arrow keys) and large steps (Page Up/Down)
- **Form association**: Can be form-associated for native form integration

**Native HTML First:** Consider using native `<input type="number">` which provides built-in semantics and keyboard support.

## Use Cases

- Quantity selectors (shopping carts, forms)
- Time/date inputs (hours, minutes, seconds)
- Age selectors
- Rating inputs
- Numeric filters
- Configuration values

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Native HTML number input -->
<input
  type="number"
  min="0"
  max="100"
  value="1"
  step="1"
  aria-label="Quantity"
>

<!-- ARIA spinbutton -->
<div role="group" aria-label="Quantity">
  <button aria-label="Decrease" type="button">-</button>
  <input
    type="text"
    role="spinbutton"
    aria-valuenow="1"
    aria-valuemin="0"
    aria-valuemax="100"
    value="1"
  >
  <button aria-label="Increase" type="button">+</button>
</div>
```

```javascript
spinbutton.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return

  const currentValue = Number(spinbutton.getAttribute('aria-valuenow'))
  const min = Number(spinbutton.getAttribute('aria-valuemin'))
  const max = Number(spinbutton.getAttribute('aria-valuemax'))

  switch(e.key) {
    case 'ArrowUp':
      e.preventDefault()
      updateValue(Math.min(max, currentValue + 1))
      break
    case 'ArrowDown':
      e.preventDefault()
      updateValue(Math.max(min, currentValue - 1))
      break
    case 'Home':
      e.preventDefault()
      updateValue(min)
      break
    case 'End':
      e.preventDefault()
      updateValue(max)
      break
  }
})
```

### Plaited Adaptation

**File Structure:**

```
spinbutton/
  spinbutton.css.ts        # Styles (createStyles) - ALWAYS separate
  spinbutton.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### spinbutton.css.ts

```typescript
// spinbutton.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'inline-block',
})

export const styles = createStyles({
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  input: {
    inlineSize: '60px',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '1rem',
  },
  button: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})
```

#### spinbutton.stories.tsx

```typescript
// spinbutton.stories.tsx
import type { FT } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './spinbutton.css.ts'

// FunctionalTemplate for static spinbutton - defined locally, NOT exported
const StaticSpinbutton: FT<{
  value: number
  min?: number
  max?: number
  'aria-label'?: string
}> = ({
  value,
  min = 0,
  max = 100,
  'aria-label': ariaLabel,
  ...attrs
}) => (
  <div {...attrs} {...styles.container}>
    <button type="button" aria-label="Decrease" {...styles.button}>−</button>
    <input
      type="text"
      role="spinbutton"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={ariaLabel}
      value={String(value)}
      readOnly
      {...styles.input}
    />
    <button type="button" aria-label="Increase" {...styles.button}>+</button>
  </div>
)

// bElement for interactive spinbutton - defined locally, NOT exported
const Spinbutton = bElement({
  tag: 'pattern-spinbutton',
  observedAttributes: ['value', 'min', 'max', 'step', 'disabled'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div {...styles.container}>
      <button
        p-target="decrease"
        type="button"
        aria-label="Decrease"
        {...styles.button}
        p-trigger={{ click: 'decrease' }}
      >−</button>
      <input
        p-target="input"
        type="text"
        role="spinbutton"
        {...styles.input}
        p-trigger={{ input: 'handleInput', keydown: 'handleKeydown', blur: 'handleBlur' }}
      />
      <button
        p-target="increase"
        type="button"
        aria-label="Increase"
        {...styles.button}
        p-trigger={{ click: 'increase' }}
      >+</button>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const input = $<HTMLInputElement>('input')[0]
    const decreaseButton = $('decrease')[0]
    const increaseButton = $('increase')[0]

    let currentValue = 1
    let min: number | undefined = 0
    let max: number | undefined = 100
    let step = 1

    const updateValue = (newValue: number, updateInput = true, emitEvent = true) => {
      let clampedValue = newValue
      if (min !== undefined) clampedValue = Math.max(min, clampedValue)
      if (max !== undefined) clampedValue = Math.min(max, clampedValue)

      currentValue = clampedValue

      if (updateInput && input) {
        input.value = String(currentValue)
      }

      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))

      if (input) {
        input.setAttribute('aria-valuenow', String(currentValue))
        if (min !== undefined) input.setAttribute('aria-valuemin', String(min))
        if (max !== undefined) input.setAttribute('aria-valuemax', String(max))
      }

      // Update button states
      const atMin = min !== undefined && currentValue <= min
      const atMax = max !== undefined && currentValue >= max
      decreaseButton?.toggleAttribute('disabled', atMin)
      increaseButton?.toggleAttribute('disabled', atMax)

      if (emitEvent) {
        emit({ type: 'input', detail: { value: currentValue } })
      }
    }

    return {
      increase() {
        if (host.hasAttribute('disabled')) return
        updateValue(currentValue + step)
        emit({ type: 'change', detail: { value: currentValue } })
      },

      decrease() {
        if (host.hasAttribute('disabled')) return
        updateValue(currentValue - step)
        emit({ type: 'change', detail: { value: currentValue } })
      },

      handleInput(event: { target: HTMLInputElement }) {
        const newValue = Number(event.target.value)
        if (!isNaN(newValue)) {
          updateValue(newValue, false)
        }
      },

      handleBlur() {
        const parsed = Number(input?.value || 0)
        updateValue(isNaN(parsed) ? currentValue : parsed, true, false)
        emit({ type: 'change', detail: { value: currentValue } })
      },

      handleKeydown(event: KeyboardEvent) {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (host.hasAttribute('disabled')) return

        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault()
            updateValue(currentValue + step)
            emit({ type: 'change', detail: { value: currentValue } })
            break
          case 'ArrowDown':
            event.preventDefault()
            updateValue(currentValue - step)
            emit({ type: 'change', detail: { value: currentValue } })
            break
          case 'Home':
            if (min !== undefined) {
              event.preventDefault()
              updateValue(min)
              emit({ type: 'change', detail: { value: currentValue } })
            }
            break
          case 'End':
            if (max !== undefined) {
              event.preventDefault()
              updateValue(max)
              emit({ type: 'change', detail: { value: currentValue } })
            }
            break
          case 'PageUp':
            event.preventDefault()
            updateValue(currentValue + step * 10)
            emit({ type: 'change', detail: { value: currentValue } })
            break
          case 'PageDown':
            event.preventDefault()
            updateValue(currentValue - step * 10)
            emit({ type: 'change', detail: { value: currentValue } })
            break
        }
      },

      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')

        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (stepAttr) step = Number(stepAttr)
        if (valueAttr) {
          updateValue(Number(valueAttr), true, false)
        } else if (min !== undefined) {
          updateValue(min, true, false)
        }
        if (ariaLabel) {
          input?.setAttribute('aria-label', ariaLabel)
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateValue(Number(newValue))
        } else if (name === 'min') {
          min = newValue ? Number(newValue) : undefined
          updateValue(currentValue)
        } else if (name === 'max') {
          max = newValue ? Number(newValue) : undefined
          updateValue(currentValue)
        } else if (name === 'step' && newValue) {
          step = Number(newValue)
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const defaultSpinbutton = story({
  intent: 'Display spinbutton with default value',
  template: () => (
    <Spinbutton value="1" min="0" max="10" aria-label="Quantity" />
  ),
  play: async ({ findByAttribute, assert }) => {
    const input = await findByAttribute('p-target', 'input')

    assert({
      given: 'spinbutton is rendered',
      should: 'have value of 1',
      actual: input?.getAttribute('aria-valuenow'),
      expected: '1',
    })
  },
})

export const quantitySpinbutton = story({
  intent: 'Quantity selector for shopping cart',
  template: () => (
    <Spinbutton value="1" min="1" max="99" step="1" aria-label="Quantity" />
  ),
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const input = await findByAttribute('p-target', 'input')
    const increase = await findByAttribute('p-target', 'increase')

    if (increase) await fireEvent(increase, 'click')

    assert({
      given: 'increase button is clicked',
      should: 'increment value by 1',
      actual: input?.getAttribute('aria-valuenow'),
      expected: '2',
    })
  },
})

export const keyboardSpinbutton = story({
  intent: 'Demonstrate keyboard navigation for spinbutton',
  template: () => (
    <Spinbutton value="5" min="0" max="10" aria-label="Rating" />
  ),
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const input = await findByAttribute('p-target', 'input')

    if (input) await fireEvent(input, 'keydown', { key: 'ArrowUp' })

    assert({
      given: 'ArrowUp is pressed',
      should: 'increment value',
      actual: input?.getAttribute('aria-valuenow'),
      expected: '6',
    })

    if (input) await fireEvent(input, 'keydown', { key: 'Home' })

    assert({
      given: 'Home is pressed',
      should: 'go to minimum',
      actual: input?.getAttribute('aria-valuenow'),
      expected: '0',
    })
  },
})

export const staticSpinbuttons = story({
  intent: 'Static spinbuttons for non-interactive display',
  template: () => (
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <StaticSpinbutton value={1} min={1} max={10} aria-label="Small" />
      <StaticSpinbutton value={50} min={0} max={100} aria-label="Medium" />
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - spinbuttons are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

- **ArrowUp**: Increases the value
- **ArrowDown**: Decreases the value
- **Home**: Sets to minimum value (if defined)
- **End**: Sets to maximum value (if defined)
- **PageUp** (Optional): Increases by larger step
- **PageDown** (Optional): Decreases by larger step

**Important Notes:**

- Focus remains on the text field during operation
- Don't interfere with browser text editing functions

## WAI-ARIA Roles, States, and Properties

### Required

- **role="spinbutton"**: The focusable element (typically text input)
- **aria-valuenow**: Current value (decimal)

### Optional

- **aria-valuemin**: Minimum allowed value
- **aria-valuemax**: Maximum allowed value
- **aria-valuetext**: Human-readable text alternative
- **aria-label** or **aria-labelledby**: Accessible name

## Best Practices

1. **Use native `<input type="number">`** when possible
2. **Use FunctionalTemplates** for static display
3. **Use bElements** for interactive spinbuttons
4. **Text editing** - Don't interfere with browser text editing functions
5. **Button states** - Disable buttons at min/max limits
6. **Use spread syntax** - `{...styles.x}` for applying styles
7. **Use `$()` with `p-target`** - never use `querySelector` directly
8. **Use `formAssociated: true`** for form integration

## Accessibility Considerations

- Screen readers announce spinbutton value and range
- Keyboard users can adjust value without mouse
- Text field allows direct value editing
- Focus indicators must be visible

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Spinbutton Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/)
- MDN: [HTML input type="number"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number)
- MDN: [ARIA spinbutton role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/spinbutton_role)
