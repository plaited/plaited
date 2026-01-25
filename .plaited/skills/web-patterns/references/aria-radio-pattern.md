# ARIA Radio Group Pattern

## Overview

A radio group is a set of checkable buttons, known as radio buttons, where no more than one of the buttons can be checked at a time. Some implementations may initialize the set with all buttons in the unchecked state in order to force the user to check one of the buttons before moving past a certain point in the workflow.

**Key Characteristics:**
- **Single selection**: Only one radio button can be checked at a time
- **Group coordination**: Radio buttons in a group coordinate their checked state
- **Keyboard navigation**: Tab, Space, Arrow keys
- **Form association**: Can be form-associated for native form integration
- **Two interaction modes**: Standalone radio groups vs. radio groups in toolbars

**Important Notes:**
- Radio groups can be initialized with all buttons unchecked
- Radio groups in toolbars have different keyboard behavior (arrow keys don't change selection)
- Use native HTML `<input type="radio">` with `<fieldset>` when possible

## Use Cases

- Form inputs (single choice from multiple options)
- Settings/preferences (theme, language, etc.)
- Rating scales (star ratings, 1-5 scale)
- Filter controls
- Toolbar controls (text alignment, view mode)
- Navigation options
- Payment method selection

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Native HTML radio group -->
<fieldset>
  <legend>Choose a color</legend>
  <input type="radio" id="red" name="color" value="red">
  <label for="red">Red</label>
  <input type="radio" id="blue" name="color" value="blue">
  <label for="blue">Blue</label>
  <input type="radio" id="green" name="color" value="green">
  <label for="green">Green</label>
</fieldset>

<!-- ARIA radio group -->
<div role="radiogroup" aria-label="Choose a color">
  <div role="radio" aria-checked="false" tabindex="0">Red</div>
  <div role="radio" aria-checked="true" tabindex="-1">Blue</div>
  <div role="radio" aria-checked="false" tabindex="-1">Green</div>
</div>
```

```javascript
// Keyboard navigation
radiogroup.addEventListener('keydown', (e) => {
  const radios = Array.from(radiogroup.querySelectorAll('[role="radio"]'))
  const currentIndex = radios.findIndex(r => r === document.activeElement)

  switch(e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % radios.length
      radios[nextIndex].focus()
      radios[currentIndex].setAttribute('aria-checked', 'false')
      radios[nextIndex].setAttribute('aria-checked', 'true')
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault()
      const prevIndex = currentIndex <= 0 ? radios.length - 1 : currentIndex - 1
      radios[prevIndex].focus()
      radios[currentIndex].setAttribute('aria-checked', 'false')
      radios[prevIndex].setAttribute('aria-checked', 'true')
      break
    case ' ':
      e.preventDefault()
      if (radios[currentIndex].getAttribute('aria-checked') !== 'true') {
        radios.forEach(r => r.setAttribute('aria-checked', 'false'))
        radios[currentIndex].setAttribute('aria-checked', 'true')
      }
      break
  }
})
```

### Plaited Adaptation

**File Structure:**

```
radio-group/
  radio-group.css.ts       # Styles (createStyles) - ALWAYS separate
  radio-group.stories.tsx  # FT/bElement + stories (imports from css.ts)
```

#### radio-group.css.ts

```typescript
// radio-group.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  radiogroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  radiogroupHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radio: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '4px',
  },
  radioFocused: {
    backgroundColor: '#f0f0f0',
  },
  radioChecked: {
    backgroundColor: '#e3f2fd',
  },
  symbol: {
    inlineSize: '18px',
    blockSize: '18px',
    border: '2px solid #333',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  symbolChecked: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  dot: {
    inlineSize: '8px',
    blockSize: '8px',
    borderRadius: '50%',
    backgroundColor: 'white',
    display: 'none',
  },
  dotVisible: {
    display: 'block',
  },
  label: {
    userSelect: 'none',
  },
})
```

#### radio-group.stories.tsx

```typescript
// radio-group.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './radio-group.css.ts'

// RadioButton FunctionalTemplate - defined locally, NOT exported
const RadioButton: FT<{
  value?: string
  'aria-checked'?: 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-checked': ariaChecked = 'false', children, ...attrs }) => (
  <div
    role="radio"
    data-value={value}
    aria-checked={ariaChecked}
    tabIndex={-1}
    {...attrs}
    {...styles.radio}
    {...(ariaChecked === 'true' ? styles.radioChecked : {})}
  >
    <div
      {...styles.symbol}
      {...(ariaChecked === 'true' ? styles.symbolChecked : {})}
      aria-hidden="true"
    >
      <div
        {...styles.dot}
        {...(ariaChecked === 'true' ? styles.dotVisible : {})}
      ></div>
    </div>
    <span {...styles.label}>{children}</span>
  </div>
)

// RadioGroup bElement - defined locally, NOT exported
const RadioGroup = bElement({
  tag: 'pattern-radio-group',
  observedAttributes: ['value', 'aria-label', 'in-toolbar', 'orientation'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target="radiogroup"
      role="radiogroup"
      tabIndex={0}
      {...styles.radiogroup}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const radiogroup = $('radiogroup')[0]
    let radios: HTMLElement[] = []
    let checkedIndex = -1
    let focusedIndex = -1
    const inToolbar = () => host.getAttribute('in-toolbar') !== null

    const getRadios = (): HTMLElement[] => {
      return Array.from(root.querySelectorAll('[role="radio"]')) as HTMLElement[]
    }

    const updateVisualState = () => {
      radios.forEach((radio, idx) => {
        const isChecked = radio.getAttribute('aria-checked') === 'true'
        const isFocused = idx === focusedIndex

        const baseClasses = styles.radio.classNames.join(' ')
        let classes = baseClasses
        if (isChecked) {
          classes = `${baseClasses} ${styles.radioChecked.classNames.join(' ')}`
        } else if (isFocused) {
          classes = `${baseClasses} ${styles.radioFocused.classNames.join(' ')}`
        }
        radio.setAttribute('class', classes)

        // Update symbol
        const symbol = radio.querySelector('[aria-hidden="true"]') as HTMLElement
        if (symbol) {
          symbol.setAttribute('class', isChecked
            ? `${styles.symbol.classNames.join(' ')} ${styles.symbolChecked.classNames.join(' ')}`
            : styles.symbol.classNames.join(' ')
          )
        }

        // Update dot
        const dot = radio.querySelector('[aria-hidden="true"] > div') as HTMLElement
        if (dot) {
          dot.setAttribute('class', isChecked
            ? `${styles.dot.classNames.join(' ')} ${styles.dotVisible.classNames.join(' ')}`
            : styles.dot.classNames.join(' ')
          )
        }
      })
    }

    const updateCheckedState = (index: number) => {
      if (index < 0 || index >= radios.length) return

      radios.forEach(radio => {
        radio.setAttribute('aria-checked', 'false')
        radio.setAttribute('tabindex', '-1')
      })

      const checkedRadio = radios[index]
      checkedRadio.setAttribute('aria-checked', 'true')
      checkedRadio.setAttribute('tabindex', '0')

      checkedIndex = index
      focusedIndex = index

      const value = checkedRadio.getAttribute('data-value') || checkedRadio.textContent || ''
      internals.setFormValue(value)
      host.setAttribute('value', value)

      updateVisualState()

      emit({ type: 'change', detail: { value, checked: checkedRadio } })
    }

    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      if (radios.length === 0) return

      let newIndex = focusedIndex
      switch (direction) {
        case 'next':
          newIndex = (focusedIndex + 1) % radios.length
          break
        case 'prev':
          newIndex = focusedIndex <= 0 ? radios.length - 1 : focusedIndex - 1
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = radios.length - 1
          break
      }

      focusedIndex = newIndex

      radios.forEach((radio, idx) => {
        radio.setAttribute('tabindex', idx === focusedIndex ? '0' : '-1')
      })

      radios[focusedIndex].focus()

      if (!inToolbar()) {
        updateCheckedState(focusedIndex)
      } else {
        updateVisualState()
      }
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        if (radios.length === 0) return

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            event.preventDefault()
            moveFocus('next')
            break

          case 'ArrowLeft':
          case 'ArrowUp':
            event.preventDefault()
            moveFocus('prev')
            break

          case ' ':
            event.preventDefault()
            if (inToolbar()) {
              if (focusedIndex >= 0 && radios[focusedIndex].getAttribute('aria-checked') !== 'true') {
                updateCheckedState(focusedIndex)
              }
            } else {
              if (focusedIndex >= 0) {
                updateCheckedState(focusedIndex)
              }
            }
            break

          case 'Enter':
            if (inToolbar()) {
              event.preventDefault()
              if (focusedIndex >= 0 && radios[focusedIndex].getAttribute('aria-checked') !== 'true') {
                updateCheckedState(focusedIndex)
              }
            }
            break
        }
      },

      handleFocus() {
        radios = getRadios()
        if (radios.length === 0) return

        if (checkedIndex >= 0) {
          focusedIndex = checkedIndex
        } else {
          focusedIndex = 0
        }

        radios.forEach((radio, idx) => {
          radio.setAttribute('tabindex', idx === focusedIndex ? '0' : '-1')
        })

        radios[focusedIndex].focus()
        updateVisualState()
      },

      handleBlur() {
        radios.forEach(radio => {
          radio.removeAttribute('data-focused')
        })
        updateVisualState()
      },

      onConnected() {
        radios = getRadios()

        const value = host.getAttribute('value')
        if (value) {
          radios.forEach((radio, idx) => {
            const radioValue = radio.getAttribute('data-value') || radio.textContent || ''
            if (radioValue === value) {
              updateCheckedState(idx)
            }
          })
        } else {
          radios.forEach((radio, idx) => {
            radio.setAttribute('aria-checked', 'false')
            radio.setAttribute('tabindex', idx === 0 ? '0' : '-1')
          })
          focusedIndex = 0
        }

        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          radiogroup?.setAttribute('aria-label', ariaLabel)
        }

        const orientation = host.getAttribute('orientation')
        if (orientation === 'horizontal') {
          radiogroup?.attr('class', `${styles.radiogroup.classNames.join(' ')} ${styles.radiogroupHorizontal.classNames.join(' ')}`)
        }

        radios.forEach((radio, idx) => {
          radio.addEventListener('click', () => {
            updateCheckedState(idx)
          })
        })

        updateVisualState()
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          radios = getRadios()
          radios.forEach((radio, idx) => {
            const radioValue = radio.getAttribute('data-value') || radio.textContent || ''
            if (radioValue === newValue) {
              updateCheckedState(idx)
            }
          })
        } else if (name === 'aria-label') {
          radiogroup?.setAttribute('aria-label', newValue || 'Radio group')
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const colorRadioGroup = story({
  intent: 'Display a radio group for color selection',
  template: () => (
    <RadioGroup aria-label="Choose a color">
      <RadioButton value="red">Red</RadioButton>
      <RadioButton value="blue" aria-checked="true">Blue</RadioButton>
      <RadioButton value="green">Green</RadioButton>
    </RadioGroup>
  ),
  play: async ({ findByAttribute, assert }) => {
    const radiogroup = await findByAttribute('role', 'radiogroup')

    assert({
      given: 'radio group is rendered',
      should: 'have radiogroup role',
      actual: radiogroup?.getAttribute('role'),
      expected: 'radiogroup',
    })
  },
})

export const horizontalRadioGroup = story({
  intent: 'Display a horizontal radio group',
  template: () => (
    <RadioGroup aria-label="Choose a size" orientation="horizontal">
      <RadioButton value="sm">Small</RadioButton>
      <RadioButton value="md" aria-checked="true">Medium</RadioButton>
      <RadioButton value="lg">Large</RadioButton>
    </RadioGroup>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkedRadio = await findByAttribute('aria-checked', 'true')

    assert({
      given: 'radio group has checked item',
      should: 'have checked radio',
      actual: checkedRadio?.getAttribute('data-value'),
      expected: 'md',
    })
  },
})

export const uncheckedRadioGroup = story({
  intent: 'Display a radio group with no initial selection',
  template: () => (
    <RadioGroup aria-label="Choose an option">
      <RadioButton value="opt1">Option 1</RadioButton>
      <RadioButton value="opt2">Option 2</RadioButton>
      <RadioButton value="opt3">Option 3</RadioButton>
    </RadioGroup>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkedRadio = await findByAttribute('aria-checked', 'true')

    assert({
      given: 'no initial selection',
      should: 'have no checked radio',
      actual: checkedRadio,
      expected: null,
    })
  },
})

export const formRadioGroup = story({
  intent: 'Display a form-associated radio group',
  template: () => (
    <form>
      <RadioGroup aria-label="Payment method" value="credit">
        <RadioButton value="credit" aria-checked="true">Credit Card</RadioButton>
        <RadioButton value="debit">Debit Card</RadioButton>
        <RadioButton value="paypal">PayPal</RadioButton>
      </RadioGroup>
    </form>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkedRadio = await findByAttribute('aria-checked', 'true')

    assert({
      given: 'form radio group',
      should: 'have pre-selected value',
      actual: checkedRadio?.getAttribute('data-value'),
      expected: 'credit',
    })
  },
})

export const accessibilityTest = story({
  intent: 'Verify radio group accessibility requirements',
  template: () => (
    <RadioGroup aria-label="Test radio group">
      <RadioButton value="a">Option A</RadioButton>
      <RadioButton value="b">Option B</RadioButton>
      <RadioButton value="c">Option C</RadioButton>
    </RadioGroup>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - radio groups use Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Standalone Radio Group

- **Tab/Shift+Tab**: Move focus into/out of radio group
- **ArrowRight/ArrowDown**: Move focus to next radio, uncheck previous, check new
- **ArrowLeft/ArrowUp**: Move focus to previous radio, uncheck previous, check new
- **Space**: Check focused radio if not already checked
- **Focus behavior**: If a radio is checked, focus goes to it; otherwise, focus goes to first radio

### Radio Group in Toolbar

- **ArrowRight/ArrowLeft**: Move focus to next/previous radio (doesn't change selection)
- **ArrowDown/ArrowUp** (optional): Move focus to next/previous radio (doesn't change selection)
- **Space**: If focused radio is not checked, uncheck current and check focused
- **Enter** (optional): Same as Space

## WAI-ARIA Roles, States, and Properties

### Required

- **role="radiogroup"**: Container for radio buttons
- **role="radio"**: Each radio button
- **aria-checked**: `true` for checked radio, `false` for unchecked

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for radio group
- **aria-label** or **aria-labelledby**: Accessible name for each radio button
- **aria-describedby**: References element providing additional description
- **tabindex**: `0` for focused radio, `-1` for others (roving tabindex pattern)

## Best Practices

1. **Use bElement** - Radio groups require coordinated state management
2. **Use FunctionalTemplates** - for static radio button rendering
3. **Roving tabindex** - Use tabindex management for keyboard navigation
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Selection follows focus** - In standalone mode, arrow keys change selection
6. **Toolbar mode** - Different behavior when in toolbar (arrow keys don't change selection)
7. **Form association** - Use `formAssociated: true` for form integration
8. **Initial state** - Can initialize with all radios unchecked
9. **Accessible labels** - Always provide labels for group and radios
10. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce radio group structure and checked state
- Keyboard users can navigate and select without mouse
- Focus indicators must be visible
- Checked state must be clearly indicated
- Group label helps users understand the choice
- Roving tabindex keeps only one radio focusable at a time
- Toolbar mode prevents accidental selection changes during navigation

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- MDN: [ARIA radiogroup role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/radiogroup_role)
- MDN: [ARIA radio role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/radio_role)
- MDN: [HTML input type="radio"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio)
- Related: [Checkbox Pattern](./aria-checkbox-pattern.md) - For multiple selections
