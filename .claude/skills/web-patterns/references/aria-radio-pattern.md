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

**Important**: In Plaited, radio groups are implemented as **bElements** because they require:
- Complex state management (coordinated checked state across buttons)
- Keyboard navigation (Tab, Space, Arrow keys)
- Form association (optional)
- Two interaction modes (standalone vs. toolbar)

#### Radio Group (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const radioGroupStyles = createStyles({
  radiogroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  radio: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '4px',
    backgroundColor: {
      $default: 'transparent',
      '[data-focused="true"]': '#f0f0f0',
      '[aria-checked="true"]': '#e3f2fd',
    },
  },
  symbol: {
    inlineSize: '18px',
    blockSize: '18px',
    border: '2px solid #333',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: {
      $default: 'transparent',
      '[aria-checked="true"]': '#007bff',
    },
  },
  dot: {
    inlineSize: '8px',
    blockSize: '8px',
    borderRadius: '50%',
    backgroundColor: 'white',
    display: {
      $default: 'none',
      '[aria-checked="true"]': 'block',
    },
  },
})

type RadioGroupEvents = {
  change: { value: string; checked: HTMLElement }
  select: { value: string; index: number }
}

export const RadioGroup = bElement<RadioGroupEvents>({
  tag: 'radio-group',
  observedAttributes: ['value', 'aria-label', 'in-toolbar'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='radiogroup'
      role='radiogroup'
      tabIndex={0}
      {...radioGroupStyles.radiogroup}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <slot name='radios'></slot>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const radiogroup = $('radiogroup')[0]
    let radios: HTMLElement[] = []
    let checkedIndex = -1
    let focusedIndex = -1
    const inToolbar = host.getAttribute('in-toolbar') !== null

    const getRadios = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="radio"]')
      ) as HTMLElement[]
    }

    const updateCheckedState = (index: number) => {
      if (index < 0 || index >= radios.length) return
      
      // Uncheck all radios
      radios.forEach(radio => {
        radio.setAttribute('aria-checked', 'false')
        radio.setAttribute('tabindex', '-1')
      })
      
      // Check selected radio
      const checkedRadio = radios[index]
      checkedRadio.setAttribute('aria-checked', 'true')
      checkedRadio.setAttribute('tabindex', '0')
      
      checkedIndex = index
      focusedIndex = index
      
      // Update form value
      const value = checkedRadio.getAttribute('data-value') || checkedRadio.textContent || ''
      internals.setFormValue(value)
      host.setAttribute('value', value)
      
      emit({
        type: 'change',
        detail: { value, checked: checkedRadio },
      })
      emit({
        type: 'select',
        detail: { value, index },
      })
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
      
      // Update tabindex
      radios.forEach((radio, idx) => {
        radio.setAttribute('tabindex', idx === focusedIndex ? '0' : '-1')
        radio.setAttribute('data-focused', idx === focusedIndex ? 'true' : 'false')
      })
      
      // Focus the radio
      radios[focusedIndex].focus()
      
      // In standalone mode, selection follows focus
      if (!inToolbar) {
        updateCheckedState(focusedIndex)
      }
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        if (radios.length === 0) return
        
        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            event.preventDefault()
            if (inToolbar) {
              // In toolbar: just move focus, don't change selection
              moveFocus('next')
            } else {
              // Standalone: move focus and change selection
              moveFocus('next')
            }
            break
            
          case 'ArrowLeft':
          case 'ArrowUp':
            event.preventDefault()
            if (inToolbar) {
              moveFocus('prev')
            } else {
              moveFocus('prev')
            }
            break
            
          case ' ':
            event.preventDefault()
            if (inToolbar) {
              // In toolbar: Space changes selection if not already checked
              if (focusedIndex >= 0 && focusedIndex < radios.length) {
                const focusedRadio = radios[focusedIndex]
                if (focusedRadio.getAttribute('aria-checked') !== 'true') {
                  updateCheckedState(focusedIndex)
                }
              }
            } else {
              // Standalone: Space checks focused radio
              if (focusedIndex >= 0 && focusedIndex < radios.length) {
                updateCheckedState(focusedIndex)
              }
            }
            break
            
          case 'Enter':
            if (inToolbar) {
              event.preventDefault()
              if (focusedIndex >= 0 && focusedIndex < radios.length) {
                const focusedRadio = radios[focusedIndex]
                if (focusedRadio.getAttribute('aria-checked') !== 'true') {
                  updateCheckedState(focusedIndex)
                }
              }
            }
            break
        }
      },
      
      handleFocus() {
        radios = getRadios()
        if (radios.length === 0) return
        
        // Set initial focus
        if (checkedIndex >= 0) {
          focusedIndex = checkedIndex
        } else {
          focusedIndex = 0
        }
        
        // Update tabindex
        radios.forEach((radio, idx) => {
          radio.setAttribute('tabindex', idx === focusedIndex ? '0' : '-1')
          radio.setAttribute('data-focused', idx === focusedIndex ? 'true' : 'false')
        })
        
        radios[focusedIndex].focus()
      },
      
      handleBlur() {
        // Remove focus indicators
        radios.forEach(radio => {
          radio.removeAttribute('data-focused')
        })
      },
      
      onConnected() {
        radios = getRadios()
        
        // Initialize from value attribute
        const value = host.getAttribute('value')
        if (value) {
          radios.forEach((radio, idx) => {
            const radioValue = radio.getAttribute('data-value') || radio.textContent || ''
            if (radioValue === value) {
              updateCheckedState(idx)
            }
          })
        } else {
          // No initial value - all unchecked
          radios.forEach((radio, idx) => {
            radio.setAttribute('aria-checked', 'false')
            radio.setAttribute('tabindex', idx === 0 ? '0' : '-1')
          })
          focusedIndex = 0
        }
        
        // Set aria-label if provided
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          radiogroup?.setAttribute('aria-label', ariaLabel)
        }
        
        // Handle radio clicks
        radios.forEach((radio, idx) => {
          radio.addEventListener('click', () => {
            updateCheckedState(idx)
          })
        })
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
```

#### Radio Button Component (Functional Template)

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'

const RadioButton: FT<{
  value?: string
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-checked': ariaChecked, children, ...attrs }) => (
  <div
    role='radio'
    data-value={value}
    aria-checked={ariaChecked}
    tabIndex={-1}
    {...attrs}
    {...joinStyles(radioGroupStyles.radio)}
    p-trigger={{ click: 'selectRadio' }}
  >
    <div {...radioGroupStyles.symbol} aria-hidden='true'>
      <div {...radioGroupStyles.dot}></div>
    </div>
    {children}
  </div>
)

// Usage in story
export const colorRadioGroup = story({
  intent: 'Radio group for color selection',
  template: () => (
    <RadioGroup aria-label='Choose a color'>
      <RadioButton slot='radios' value='red' aria-checked='false'>Red</RadioButton>
      <RadioButton slot='radios' value='blue' aria-checked='true'>Blue</RadioButton>
      <RadioButton slot='radios' value='green' aria-checked='false'>Green</RadioButton>
    </RadioGroup>
  ),
})
```

#### Form-Associated Radio Group

```typescript
export const FormRadioGroup = bElement<RadioGroupEvents>({
  tag: 'form-radio-group',
  observedAttributes: ['name', 'value', 'required'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='radiogroup'
      role='radiogroup'
      tabIndex={0}
      {...radioGroupStyles.radiogroup}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus' }}
    >
      <slot name='radios'></slot>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const radiogroup = $('radiogroup')[0]
    let radios: HTMLElement[] = []
    let checkedIndex = -1
    let focusedIndex = -1
    
    const updateCheckedState = (index: number) => {
      if (index < 0 || index >= radios.length) return
      
      radios.forEach(radio => {
        radio.setAttribute('aria-checked', 'false')
      })
      
      const checkedRadio = radios[index]
      checkedRadio.setAttribute('aria-checked', 'true')
      checkedIndex = index
      
      const value = checkedRadio.getAttribute('data-value') || checkedRadio.textContent || ''
      internals.setFormValue(value)
      host.setAttribute('value', value)
      
      // Validation
      if (host.hasAttribute('required') && !value) {
        internals.setValidity({ valueMissing: true }, 'Please select an option')
      } else {
        internals.setValidity({})
      }
      
      emit({ type: 'change', detail: { value, checked: checkedRadio } })
    }
    
    // ... rest of implementation similar to RadioGroup above
    
    return {
      // ... handlers
      onConnected() {
        // Set form name
        const name = host.getAttribute('name')
        if (name) {
          internals.setFormValue('', name) // Empty value, but set name
        }
        
        // ... rest of initialization
      },
    }
  },
})
```

#### Radio Group in Toolbar

```typescript
export const ToolbarRadioGroup = bElement<RadioGroupEvents>({
  tag: 'toolbar-radio-group',
  observedAttributes: ['value', 'aria-label'],
  shadowDom: (
    <div
      p-target='radiogroup'
      role='radiogroup'
      {...radioGroupStyles.radiogroup}
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      <slot name='radios'></slot>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    // Similar to RadioGroup but with inToolbar = true behavior
    // Arrow keys move focus but don't change selection
    // Space/Enter change selection
    // ...
  },
})
```

#### Rating Radio Group Example

```typescript
export const RatingRadioGroup = bElement<RadioGroupEvents>({
  tag: 'rating-radio-group',
  observedAttributes: ['value', 'max'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='radiogroup'
      role='radiogroup'
      aria-label='Rating'
      tabIndex={0}
      {...radioGroupStyles.radiogroup}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus' }}
    >
      <slot name='radios'></slot>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const radiogroup = $('radiogroup')[0]
    let radios: HTMLElement[] = []
    let checkedIndex = -1
    let maxRating = 5
    
    const renderRadios = () => {
      const container = radiogroup
      const radioElements = []
      
      for (let i = 1; i <= maxRating; i++) {
        radioElements.push(
          <div
            role='radio'
            data-value={String(i)}
            aria-checked={i === checkedIndex + 1 ? 'true' : 'false'}
            tabIndex={i === checkedIndex + 1 ? 0 : -1}
            {...radioGroupStyles.radio}
            p-trigger={{ click: 'selectRating' }}
          >
            <div {...radioGroupStyles.symbol} aria-hidden='true'>
              <div {...radioGroupStyles.dot}></div>
            </div>
            {i <= (checkedIndex + 1) ? '★' : '☆'}
          </div>
        )
      }
      
      container?.render(...radioElements)
      radios = getRadios()
    }
    
    return {
      selectRating(event: { target: HTMLElement }) {
        const value = event.target.getAttribute('data-value')
        const index = radios.findIndex(r => r.getAttribute('data-value') === value)
        if (index >= 0) {
          updateCheckedState(index)
        }
      },
      // ... other handlers
      onConnected() {
        const maxAttr = host.getAttribute('max')
        if (maxAttr) maxRating = Number(maxAttr)
        renderRadios()
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - radio groups use Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `render()` for dynamic radios
- **Requires external web API**: No - uses standard DOM APIs
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
2. **Roving tabindex** - Use tabindex management for keyboard navigation
3. **Selection follows focus** - In standalone mode, arrow keys change selection
4. **Toolbar mode** - Different behavior when in toolbar (arrow keys don't change selection)
5. **Form association** - Use `formAssociated: true` for form integration
6. **Initial state** - Can initialize with all radios unchecked
7. **Accessible labels** - Always provide labels for group and radios
8. **Native alternative** - Consider native `<input type="radio">` with `<fieldset>`
9. **Visual feedback** - Clear indication of checked and focused states
10. **Keyboard shortcuts** - Support all required keyboard interactions

## Accessibility Considerations

- Screen readers announce radio group structure and checked state
- Keyboard users can navigate and select without mouse
- Focus indicators must be visible
- Checked state must be clearly indicated
- Group label helps users understand the choice
- Roving tabindex keeps only one radio focusable at a time
- Toolbar mode prevents accidental selection changes during navigation

## Radio Group Variants

### Standalone Radio Group
- Standard form input
- Selection follows focus
- Arrow keys change both focus and selection

### Toolbar Radio Group
- Nested in toolbar
- Arrow keys only move focus
- Space/Enter change selection
- Prevents accidental selection changes

### Rating Radio Group
- Star or numeric rating
- Visual representation (stars, numbers)
- Same keyboard behavior as standard group

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA radio group pattern has universal support in modern browsers with assistive technology. Native HTML radio inputs also have universal support.

## References

- Source: [W3C ARIA Authoring Practices Guide - Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- MDN: [ARIA radiogroup role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/radiogroup_role)
- MDN: [ARIA radio role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/radio_role)
- MDN: [HTML input type="radio"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio)
- Related: [Checkbox Pattern](./aria-checkbox-pattern.md) - For multiple selections
