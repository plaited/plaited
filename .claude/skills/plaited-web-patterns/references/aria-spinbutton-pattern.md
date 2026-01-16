# ARIA Spinbutton Pattern

## Overview

A spinbutton is an input widget that restricts its value to a set or range of discrete values. For example, in a widget that enables users to set an alarm, a spinbutton could allow users to select a number from 0 to 59 for the minute of an hour.

**Key Characteristics:**
- **Discrete values**: Restricts value to a set or range
- **Text field**: Displays current value, usually the only focusable component
- **Increase/decrease buttons**: Visual buttons (keyboard accessible via arrow keys)
- **Direct editing**: Text field allows users to directly edit the value
- **Step values**: Can support small steps (Arrow keys) and large steps (Page Up/Down)
- **Form association**: Can be form-associated for native form integration

**Components:**
1. Text field - displays current value, focusable, allows direct editing
2. Increase button - visually present but keyboard accessible via Arrow keys
3. Decrease button - visually present but keyboard accessible via Arrow keys

**Note**: Use native HTML `<input type="number">` when possible, as it provides built-in semantics, keyboard support, and validation. The ARIA spinbutton pattern provides more control over styling and behavior.

## Use Cases

- Quantity selectors (shopping carts, forms)
- Time/date inputs (hours, minutes, seconds)
- Alarm/time pickers
- Age selectors
- Rating inputs
- Numeric filters
- Count selectors
- Configuration values (port numbers, timeouts)

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

<!-- ARIA spinbutton (when native element can't be used) -->
<div role="group" aria-label="Quantity">
  <input
    type="text"
    role="spinbutton"
    aria-valuenow="1"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label="Quantity"
    value="1"
  >
  <button aria-label="Increase" type="button">+</button>
  <button aria-label="Decrease" type="button">-</button>
</div>
```

```javascript
// Keyboard navigation
spinbutton.addEventListener('keydown', (e) => {
  const currentValue = Number(spinbutton.getAttribute('aria-valuenow'))
  const min = Number(spinbutton.getAttribute('aria-valuemin'))
  const max = Number(spinbutton.getAttribute('aria-valuemax'))
  const step = Number(spinbutton.getAttribute('data-step') || 1)
  
  // Don't interfere with text editing keys
  if (e.ctrlKey || e.metaKey || e.altKey) return
  
  let newValue = currentValue
  
  switch(e.key) {
    case 'ArrowUp':
      e.preventDefault()
      newValue = Math.min(max, currentValue + step)
      break
    case 'ArrowDown':
      e.preventDefault()
      newValue = Math.max(min, currentValue - step)
      break
    case 'Home':
      if (min !== undefined) {
        e.preventDefault()
        newValue = min
      }
      break
    case 'End':
      if (max !== undefined) {
        e.preventDefault()
        newValue = max
      }
      break
    case 'PageUp':
      e.preventDefault()
      const largeStep = step * 10
      newValue = Math.min(max, currentValue + largeStep)
      break
    case 'PageDown':
      e.preventDefault()
      const largeStep = step * 10
      newValue = Math.max(min, currentValue - largeStep)
      break
  }
  
  if (newValue !== currentValue) {
    updateValue(newValue)
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, spinbuttons can be implemented as:
1. **bElements wrapping native `<input type="number">`** (preferred for form association)
2. **bElements with custom ARIA spinbutton** (for advanced styling/behavior)
3. **Functional Templates** for static displays

#### Native Number Input Wrapper (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const spinbuttonStyles = createStyles({
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  input: {
    inlineSize: '80px',
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
    ':hover': {
      backgroundColor: '#f0f0f0',
    },
    ':active': {
      backgroundColor: '#e0e0e0',
    },
  },
})

type SpinbuttonEvents = {
  input: { value: number }
  change: { value: number }
}

export const Spinbutton = bElement<SpinbuttonEvents>({
  tag: 'spin-button',
  observedAttributes: ['value', 'min', 'max', 'step', 'aria-label', 'disabled'],
  formAssociated: true,
  shadowDom: (
    <div {...spinbuttonStyles.container}>
      <button
        p-target='decrease-button'
        type='button'
        aria-label='Decrease'
        {...spinbuttonStyles.button}
        p-trigger={{ click: 'decrease' }}
      >
        −
      </button>
      <input
        p-target='input'
        type='number'
        {...spinbuttonStyles.input}
        p-trigger={{ input: 'handleInput', change: 'handleChange', keydown: 'handleKeydown' }}
      />
      <button
        p-target='increase-button'
        type='button'
        aria-label='Increase'
        {...spinbuttonStyles.button}
        p-trigger={{ click: 'increase' }}
      >
        +
      </button>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const input = $<HTMLInputElement>('input')[0]
    const decreaseButton = $('decrease-button')[0]
    const increaseButton = $('increase-button')[0]
    
    let currentValue = 1
    let min: number | undefined
    let max: number | undefined
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
      
      // Update ARIA attributes
      if (input) {
        input.setAttribute('aria-valuenow', String(currentValue))
        if (min !== undefined) input.setAttribute('aria-valuemin', String(min))
        if (max !== undefined) input.setAttribute('aria-valuemax', String(max))
      }
      
      // Update button states
      if (min !== undefined) {
        decreaseButton?.toggleAttribute('disabled', currentValue <= min)
      }
      if (max !== undefined) {
        increaseButton?.toggleAttribute('disabled', currentValue >= max)
      }
      
      if (emitEvent) {
        emit({ type: 'input', detail: { value: currentValue } })
      }
    }
    
    return {
      increase() {
        updateValue(currentValue + step)
        emit({ type: 'change', detail: { value: currentValue } })
      },
      
      decrease() {
        updateValue(currentValue - step)
        emit({ type: 'change', detail: { value: currentValue } })
      },
      
      handleInput(event: { target: HTMLInputElement }) {
        const newValue = Number(event.target.value)
        if (!isNaN(newValue)) {
          updateValue(newValue, false)
        }
      },
      
      handleChange(event: { target: HTMLInputElement }) {
        const newValue = Number(event.target.value)
        if (!isNaN(newValue)) {
          updateValue(newValue, false)
          emit({ type: 'change', detail: { value: currentValue } })
        }
      },
      
      handleKeydown(event: KeyboardEvent) {
        // Don't interfere with text editing (Ctrl/Cmd, Alt, etc.)
        if (event.ctrlKey || event.metaKey || event.altKey) return
        
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
            updateValue(currentValue + (step * 10))
            emit({ type: 'change', detail: { value: currentValue } })
            break
            
          case 'PageDown':
            event.preventDefault()
            updateValue(currentValue - (step * 10))
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
        const disabled = host.hasAttribute('disabled')
        
        if (minAttr) {
          min = Number(minAttr)
          input?.setAttribute('min', String(min))
        }
        if (maxAttr) {
          max = Number(maxAttr)
          input?.setAttribute('max', String(max))
        }
        if (stepAttr) {
          step = Number(stepAttr)
          input?.setAttribute('step', String(step))
        }
        if (valueAttr) {
          updateValue(Number(valueAttr), true, false)
        } else if (min !== undefined) {
          updateValue(min, true, false)
        } else {
          updateValue(0, true, false)
        }
        if (ariaLabel) {
          input?.setAttribute('aria-label', ariaLabel)
        }
        if (disabled) {
          input?.setAttribute('disabled', '')
          decreaseButton?.setAttribute('disabled', '')
          increaseButton?.setAttribute('disabled', '')
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateValue(Number(newValue))
        } else if (name === 'min') {
          min = newValue ? Number(newValue) : undefined
          input?.setAttribute('min', newValue || '')
          updateValue(currentValue)
        } else if (name === 'max') {
          max = newValue ? Number(newValue) : undefined
          input?.setAttribute('max', newValue || '')
          updateValue(currentValue)
        } else if (name === 'step') {
          step = Number(newValue)
          input?.setAttribute('step', newValue || '1')
        } else if (name === 'aria-label') {
          input?.setAttribute('aria-label', newValue || 'Spinbutton')
        } else if (name === 'disabled') {
          const isDisabled = newValue !== null
          input?.toggleAttribute('disabled', isDisabled)
          decreaseButton?.toggleAttribute('disabled', isDisabled)
          increaseButton?.toggleAttribute('disabled', isDisabled)
        }
      },
    }
  },
})
```

#### Custom ARIA Spinbutton (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const customSpinbuttonStyles = createStyles({
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  input: {
    inlineSize: '80px',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '1rem',
    outline: 'none',
    '&:focus': {
      borderColor: '#007bff',
      boxShadow: '0 0 0 2px rgba(0, 123, 255, 0.25)',
    },
    '&[aria-invalid="true"]': {
      borderColor: '#dc3545',
    },
  },
  button: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '1.25rem',
    lineHeight: 1,
    ':hover': {
      backgroundColor: '#f0f0f0',
    },
    ':active': {
      backgroundColor: '#e0e0e0',
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
})

type CustomSpinbuttonEvents = {
  input: { value: number }
  change: { value: number }
}

export const CustomSpinbutton = bElement<CustomSpinbuttonEvents>({
  tag: 'custom-spinbutton',
  observedAttributes: ['value', 'min', 'max', 'step', 'aria-label', 'aria-valuetext', 'disabled'],
  formAssociated: true,
  shadowDom: (
    <div {...customSpinbuttonStyles.container}>
      <button
        p-target='decrease-button'
        type='button'
        aria-label='Decrease'
        {...customSpinbuttonStyles.button}
        p-trigger={{ click: 'decrease' }}
      >
        −
      </button>
      <input
        p-target='input'
        type='text'
        role='spinbutton'
        {...customSpinbuttonStyles.input}
        p-trigger={{ input: 'handleInput', change: 'handleChange', keydown: 'handleKeydown', blur: 'handleBlur' }}
      />
      <button
        p-target='increase-button'
        type='button'
        aria-label='Increase'
        {...customSpinbuttonStyles.button}
        p-trigger={{ click: 'increase' }}
      >
        +
      </button>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const input = $<HTMLInputElement>('input')[0]
    const decreaseButton = $('decrease-button')[0]
    const increaseButton = $('increase-button')[0]
    
    let currentValue = 1
    let min: number | undefined
    let max: number | undefined
    let step = 1
    let isValid = true
    
    const updateValue = (newValue: number, updateInput = true, emitEvent = true) => {
      let clampedValue = newValue
      if (min !== undefined) clampedValue = Math.max(min, clampedValue)
      if (max !== undefined) clampedValue = Math.min(max, clampedValue)
      
      currentValue = clampedValue
      isValid = (min === undefined || currentValue >= min) && (max === undefined || currentValue <= max)
      
      if (updateInput && input) {
        input.value = String(currentValue)
      }
      
      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))
      
      // Update ARIA attributes
      if (input) {
        input.setAttribute('aria-valuenow', String(currentValue))
        input.setAttribute('aria-invalid', isValid ? 'false' : 'true')
        if (min !== undefined) input.setAttribute('aria-valuemin', String(min))
        if (max !== undefined) input.setAttribute('aria-valuemax', String(max))
      }
      
      // Update button states
      if (min !== undefined) {
        decreaseButton?.toggleAttribute('disabled', currentValue <= min)
      }
      if (max !== undefined) {
        increaseButton?.toggleAttribute('disabled', currentValue >= max)
      }
      
      // Validation
      if (!isValid) {
        internals.setValidity({ rangeOverflow: currentValue > (max || Infinity), rangeUnderflow: currentValue < (min || -Infinity) }, 'Value out of range')
        internals.states.add('invalid')
      } else {
        internals.setValidity({})
        internals.states.delete('invalid')
      }
      
      if (emitEvent) {
        emit({ type: 'input', detail: { value: currentValue } })
      }
    }
    
    const parseInputValue = (text: string): number | null => {
      const parsed = Number(text.trim())
      return isNaN(parsed) ? null : parsed
    }
    
    return {
      increase() {
        updateValue(currentValue + step)
        emit({ type: 'change', detail: { value: currentValue } })
      },
      
      decrease() {
        updateValue(currentValue - step)
        emit({ type: 'change', detail: { value: currentValue } })
      },
      
      handleInput(event: { target: HTMLInputElement }) {
        const text = event.target.value
        const parsed = parseInputValue(text)
        
        if (parsed !== null) {
          updateValue(parsed, false)
        }
      },
      
      handleChange(event: { target: HTMLInputElement }) {
        const text = event.target.value
        const parsed = parseInputValue(text)
        
        if (parsed !== null) {
          updateValue(parsed, false)
          emit({ type: 'change', detail: { value: currentValue } })
        } else {
          // Reset to current value if invalid
          input?.attr('value', String(currentValue))
        }
      },
      
      handleBlur() {
        // Validate and correct on blur
        const text = input?.value || ''
        const parsed = parseInputValue(text)
        
        if (parsed !== null) {
          updateValue(parsed, true, false)
          emit({ type: 'change', detail: { value: currentValue } })
        } else {
          input?.attr('value', String(currentValue))
        }
      },
      
      handleKeydown(event: KeyboardEvent) {
        // Don't interfere with text editing (Ctrl/Cmd, Alt, etc.)
        if (event.ctrlKey || event.metaKey || event.altKey) return
        
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
            updateValue(currentValue + (step * 10))
            emit({ type: 'change', detail: { value: currentValue } })
            break
            
          case 'PageDown':
            event.preventDefault()
            updateValue(currentValue - (step * 10))
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
        const ariaValueText = host.getAttribute('aria-valuetext')
        const disabled = host.hasAttribute('disabled')
        
        if (minAttr) {
          min = Number(minAttr)
          input?.setAttribute('aria-valuemin', String(min))
        }
        if (maxAttr) {
          max = Number(maxAttr)
          input?.setAttribute('aria-valuemax', String(max))
        }
        if (stepAttr) {
          step = Number(stepAttr)
        }
        if (valueAttr) {
          updateValue(Number(valueAttr), true, false)
        } else if (min !== undefined) {
          updateValue(min, true, false)
        } else {
          updateValue(0, true, false)
        }
        if (ariaLabel) {
          input?.setAttribute('aria-label', ariaLabel)
        }
        if (ariaValueText) {
          input?.setAttribute('aria-valuetext', ariaValueText)
        }
        if (disabled) {
          input?.setAttribute('disabled', '')
          decreaseButton?.setAttribute('disabled', '')
          increaseButton?.setAttribute('disabled', '')
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateValue(Number(newValue))
        } else if (name === 'min') {
          min = newValue ? Number(newValue) : undefined
          input?.setAttribute('aria-valuemin', newValue || '')
          updateValue(currentValue)
        } else if (name === 'max') {
          max = newValue ? Number(newValue) : undefined
          input?.setAttribute('aria-valuemax', newValue || '')
          updateValue(currentValue)
        } else if (name === 'step') {
          step = Number(newValue)
        } else if (name === 'aria-label') {
          input?.setAttribute('aria-label', newValue || 'Spinbutton')
        } else if (name === 'aria-valuetext') {
          input?.setAttribute('aria-valuetext', newValue || '')
        } else if (name === 'disabled') {
          const isDisabled = newValue !== null
          input?.toggleAttribute('disabled', isDisabled)
          decreaseButton?.toggleAttribute('disabled', isDisabled)
          increaseButton?.toggleAttribute('disabled', isDisabled)
        }
      },
    }
  },
})
```

#### Quantity Spinbutton Example

```typescript
export const quantitySpinbutton = story({
  intent: 'Quantity selector for shopping cart',
  template: () => (
    <Spinbutton
      min='1'
      max='99'
      value='1'
      step='1'
      aria-label='Quantity'
      name='quantity'
    />
  ),
})
```

#### Time Spinbutton Example

```typescript
export const TimeSpinbutton = bElement<CustomSpinbuttonEvents>({
  tag: 'time-spinbutton',
  observedAttributes: ['value', 'min', 'max', 'unit'],
  formAssociated: true,
  shadowDom: (
    <div {...customSpinbuttonStyles.container}>
      <button
        p-target='decrease-button'
        type='button'
        aria-label='Decrease'
        {...customSpinbuttonStyles.button}
        p-trigger={{ click: 'decrease' }}
      >
        −
      </button>
      <input
        p-target='input'
        type='text'
        role='spinbutton'
        {...customSpinbuttonStyles.input}
        p-trigger={{ input: 'handleInput', keydown: 'handleKeydown', blur: 'handleBlur' }}
      />
      <button
        p-target='increase-button'
        type='button'
        aria-label='Increase'
        {...customSpinbuttonStyles.button}
        p-trigger={{ click: 'increase' }}
      >
        +
      </button>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const input = $<HTMLInputElement>('input')[0]
    let currentValue = 0
    let min = 0
    let max = 59
    const unit = host.getAttribute('unit') || 'minute'
    
    const formatValue = (value: number): string => {
      return String(value).padStart(2, '0')
    }
    
    const updateValue = (newValue: number) => {
      currentValue = Math.max(min, Math.min(max, newValue))
      input?.attr('value', formatValue(currentValue))
      input?.setAttribute('aria-valuenow', String(currentValue))
      input?.setAttribute('aria-valuetext', `${currentValue} ${unit}s`)
      input?.setAttribute('aria-label', `${unit} selector`)
      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))
      emit({ type: 'input', detail: { value: currentValue } })
    }
    
    return {
      increase() {
        updateValue(currentValue + 1)
      },
      decrease() {
        updateValue(currentValue - 1)
      },
      handleInput(event: { target: HTMLInputElement }) {
        const parsed = Number(event.target.value)
        if (!isNaN(parsed)) {
          updateValue(parsed)
        }
      },
      handleBlur() {
        const parsed = Number(input?.value || 0)
        updateValue(isNaN(parsed) ? currentValue : parsed)
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault()
            updateValue(currentValue + 1)
            break
          case 'ArrowDown':
            event.preventDefault()
            updateValue(currentValue - 1)
            break
          case 'Home':
            event.preventDefault()
            updateValue(min)
            break
          case 'End':
            event.preventDefault()
            updateValue(max)
            break
        }
      },
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (valueAttr) {
          updateValue(Number(valueAttr))
        } else {
          updateValue(min)
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateValue(Number(newValue))
        } else if (name === 'min') {
          min = Number(newValue)
          updateValue(currentValue)
        } else if (name === 'max') {
          max = Number(newValue)
          updateValue(currentValue)
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - spinbuttons use Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

- **ArrowUp**: Increases the value
- **ArrowDown**: Decreases the value
- **Home**: Sets to minimum value (if minimum exists)
- **End**: Sets to maximum value (if maximum exists)
- **PageUp** (Optional): Increases by larger step (e.g., step × 10)
- **PageDown** (Optional): Decreases by larger step (e.g., step × 10)
- **Text editing keys**: Standard single-line text editing keys (input, cursor movement, selection, text manipulation)

**Important Notes:**
- Focus remains on the text field during operation
- Don't interfere with browser-provided text editing functions (Ctrl/Cmd, Alt, etc.)
- Standard text editing keys depend on the device platform
- Most robust approach: rely on browsers for text editing (use `<input type="text">` or `contenteditable`)

## WAI-ARIA Roles, States, and Properties

### Required

- **role="spinbutton"**: The focusable element (typically text input)
- **aria-valuenow**: Current value (decimal)

### Optional

- **aria-valuemin**: Minimum allowed value (decimal)
- **aria-valuemax**: Maximum allowed value (decimal)
- **aria-valuetext**: Human-readable text alternative (e.g., "Monday" for day of week)
- **aria-label** or **aria-labelledby**: Accessible name for spinbutton
- **aria-invalid**: Set to `true` if value is outside allowed range
- **aria-describedby**: References element providing additional description

### Native HTML `<input type="number">` Attributes

- **min**: Minimum value
- **max**: Maximum value
- **value**: Current value
- **step**: Step increment (default: 1)
- **disabled**: Disables the input

## Best Practices

1. **Use native `<input type="number">`** - Prefer native element when possible
2. **bElement for custom** - Use bElement for advanced styling/behavior
3. **Text editing** - Don't interfere with browser text editing functions
4. **Keyboard support** - Implement all required keyboard interactions
5. **Validation** - Validate input and provide feedback
6. **Value text** - Use `aria-valuetext` for user-friendly descriptions
7. **Form association** - Use `formAssociated: true` for form integration
8. **Button states** - Disable buttons at min/max limits
9. **Focus management** - Keep focus on text field
10. **Step values** - Support small steps (Arrow keys) and large steps (Page Up/Down)

## Accessibility Considerations

- Screen readers announce spinbutton value and range
- Keyboard users can adjust value without mouse
- Text field allows direct value editing
- Focus indicators must be visible
- Invalid values should be clearly indicated
- `aria-valuetext` provides context beyond numeric value
- Buttons should be visually present but keyboard accessible via arrow keys
- Don't interfere with standard text editing keyboard shortcuts

## Spinbutton Variants

### Quantity Spinbutton
- Common use: Shopping carts, forms
- Range: Usually 1 to max quantity
- Step: 1
- Example: Quantity selector

### Time Spinbutton
- Common use: Time/date pickers
- Range: 0-59 (minutes/seconds), 0-23 (hours)
- Step: 1
- Format: Often padded (e.g., "05")
- Custom `aria-valuetext`: "5 minutes"

### Age Spinbutton
- Common use: Age selection
- Range: 0-120 (typical)
- Step: 1
- Example: Age input

### Rating Spinbutton
- Common use: Rating inputs
- Range: 1-5 or 1-10
- Step: 1
- Example: Rating selector

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<input type="number">`) |
| Firefox | Full support (native `<input type="number">`) |
| Safari | Full support (native `<input type="number">`) |
| Edge | Full support (native `<input type="number">`) |

**Note**: Native HTML `<input type="number">` has universal support in modern browsers. ARIA `role="spinbutton"` also has universal support with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Spinbutton Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/)
- MDN: [HTML input type="number"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number)
- MDN: [ARIA spinbutton role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/spinbutton_role)
- Related: [Slider Pattern](./aria-slider-pattern.md) - For continuous range selection
