# ARIA Checkbox Pattern

## Overview

WAI-ARIA supports two types of checkbox widgets: dual-state checkboxes toggle between two choices (checked and not checked), and tri-state checkboxes, which allow an additional third state known as partially checked (mixed).

**Key Characteristics:**
- **Dual-state**: Checked (`true`) or unchecked (`false`)
- **Tri-state**: Checked (`true`), unchecked (`false`), or mixed (`mixed`)
- **Keyboard interaction**: Space key toggles state
- **Form association**: Can be form-associated for native form integration

**Common Use Cases for Tri-State:**
- Software installers with grouped options
- Select all/none controls
- Hierarchical selection (parent/child relationships)

## Use Cases

- Form inputs (terms acceptance, preferences)
- Settings toggles
- Multi-select lists
- Select all/none functionality
- Grouped options with parent control
- Filter controls

## Implementation

### Vanilla JavaScript

```html
<!-- Dual-state checkbox -->
<div role="checkbox" aria-checked="false" tabindex="0" aria-label="Accept terms">
  Accept terms and conditions
</div>

<!-- Tri-state checkbox -->
<div role="checkbox" aria-checked="mixed" tabindex="0" aria-label="Select all options">
  Select all
</div>

<!-- Native checkbox -->
<input type="checkbox" id="terms" aria-label="Accept terms">
<label for="terms">Accept terms and conditions</label>
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

// Tri-state toggle
function toggleTriState(checkbox) {
  const currentState = checkbox.getAttribute('aria-checked')
  let newState
  if (currentState === 'true') {
    newState = 'false'
  } else if (currentState === 'mixed') {
    newState = 'true'
  } else {
    newState = 'mixed'
  }
  checkbox.setAttribute('aria-checked', newState)
}
```

### Plaited Adaptation

**Important**: In Plaited, checkboxes can be implemented as:
1. **Functional Templates (FT)** for static checkboxes in stories
2. **bElements** for form-associated checkboxes that need form integration
3. **bElements** for tri-state checkboxes that need complex state management

#### Static Checkbox (Functional Template)

```typescript
// checkbox.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { checkboxStyles } from './checkbox.css.ts'

const Checkbox: FT<{
  'aria-checked': 'true' | 'false' | 'mixed'
  'aria-label'?: string
  disabled?: boolean
  children?: Children
}> = ({
  'aria-checked': ariaChecked,
  'aria-label': ariaLabel,
  disabled,
  children,
  ...attrs
}) => (
  <div
    role='checkbox'
    aria-checked={ariaChecked}
    aria-label={ariaLabel}
    tabIndex={disabled ? -1 : 0}
    {...attrs}
    {...joinStyles(
      checkboxStyles.checkbox,
      ariaChecked === 'true' && checkboxStyles.checked,
      ariaChecked === 'mixed' && checkboxStyles.mixed,
      disabled && checkboxStyles.disabled
    )}
  >
    {children}
  </div>
)

export const checkboxStory = story({
  intent: 'Display a checkbox in checked state',
  template: () => (
    <Checkbox aria-checked='true' aria-label='Accept terms'>
      Accept terms and conditions
    </Checkbox>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

#### Form-Associated Checkbox (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles, createHostStyles } from 'plaited/ui'
import { isTypeOf } from 'plaited/utils'

const checkboxStyles = createStyles({
  checkbox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
  },
  symbol: {
    inlineSize: '16px',
    blockSize: '16px',
    border: '2px solid #333',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: {
      $default: 'transparent',
      '[aria-checked="true"]': '#007bff',
      '[aria-checked="mixed"]': '#007bff',
    },
  },
  checkmark: {
    display: {
      $default: 'none',
      '[aria-checked="true"]': 'block',
    },
    color: 'white',
    fontSize: '12px',
  },
  minus: {
    display: {
      $default: 'none',
      '[aria-checked="mixed"]': 'block',
    },
    color: 'white',
    fontSize: '12px',
  },
})

const hostStyles = createHostStyles({
  display: 'inline-block',
})

type CheckboxEvents = {
  checked: boolean
  change: { checked: boolean; value: string | null }
}

export const FormCheckbox = bElement<CheckboxEvents>({
  tag: 'form-checkbox',
  observedAttributes: ['checked', 'disabled', 'value'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target='checkbox'
      role='checkbox'
      aria-checked='false'
      tabIndex={0}
      {...checkboxStyles.checkbox}
      p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
    >
      <div
        p-target='symbol'
        {...checkboxStyles.symbol}
      >
        <span {...checkboxStyles.checkmark}>✓</span>
        <span {...checkboxStyles.minus}>−</span>
      </div>
      <slot></slot>
    </div>
  ),
  bProgram({ $, host, internals, root, trigger, emit }) {
    const checkbox = $('checkbox')[0]
    const symbol = $('symbol')[0]
    let checked = false

    const updateState = (newChecked: boolean) => {
      checked = newChecked
      checkbox?.attr('aria-checked', checked ? 'true' : 'false')
      symbol?.attr('aria-checked', checked ? 'true' : 'false')
      
      // Update form value
      if (checked) {
        internals.setFormValue('on', host.getAttribute('value') || 'checked')
        internals.states.add('checked')
      } else {
        internals.setFormValue('off')
        internals.states.delete('checked')
      }
      
      // Update host attribute
      host.toggleAttribute('checked', checked)
      
      trigger({ type: 'checked', detail: checked })
      emit({
        type: 'change',
        detail: {
          checked,
          value: host.getAttribute('value'),
        },
      })
    }

    return {
      toggle() {
        if (internals.states.has('disabled')) return
        updateState(!checked)
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === ' ' && !internals.states.has('disabled')) {
          event.preventDefault()
          checkbox?.click()
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          const isChecked = isTypeOf<string>(newValue, 'string')
          if (isChecked !== checked) {
            updateState(isChecked)
          }
        }
        if (name === 'disabled') {
          const isDisabled = isTypeOf<string>(newValue, 'string')
          if (isDisabled) {
            internals.states.add('disabled')
            checkbox?.attr('tabIndex', '-1')
          } else {
            internals.states.delete('disabled')
            checkbox?.attr('tabIndex', '0')
          }
        }
      },
      onConnected() {
        // Initialize from attributes
        if (host.hasAttribute('checked')) {
          checked = true
          updateState(true)
        }
        if (host.hasAttribute('disabled')) {
          internals.states.add('disabled')
          checkbox?.attr('tabIndex', '-1')
        }
        
        // Set accessible label from slot content or aria-label
        const label = host.getAttribute('aria-label') || 
                     host.textContent?.trim() || 
                     'Checkbox'
        checkbox?.attr('aria-label', label)
      },
    }
  },
})
```

#### Tri-State Checkbox (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const triStateStyles = createStyles({
  checkbox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  symbol: {
    inlineSize: '16px',
    blockSize: '16px',
    border: '2px solid #333',
    borderRadius: '3px',
    backgroundColor: {
      $default: 'transparent',
      '[aria-checked="true"]': '#007bff',
      '[aria-checked="mixed"]': '#007bff',
    },
  },
  checkmark: {
    display: {
      $default: 'none',
      '[aria-checked="true"]': 'block',
    },
  },
  minus: {
    display: {
      $default: 'none',
      '[aria-checked="mixed"]': 'block',
    },
  },
})

type TriStateCheckboxEvents = {
  stateChange: { state: 'true' | 'false' | 'mixed' }
}

export const TriStateCheckbox = bElement<TriStateCheckboxEvents>({
  tag: 'tri-state-checkbox',
  observedAttributes: ['aria-checked'],
  shadowDom: (
    <div
      p-target='checkbox'
      role='checkbox'
      aria-checked='false'
      tabIndex={0}
      {...triStateStyles.checkbox}
      p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
    >
      <div
        p-target='symbol'
        {...triStateStyles.symbol}
      >
        <span {...triStateStyles.checkmark}>✓</span>
        <span {...triStateStyles.minus}>−</span>
      </div>
      <slot></slot>
    </div>
  ),
  bProgram({ $, host, trigger, emit }) {
    const checkbox = $('checkbox')[0]
    const symbol = $('symbol')[0]
    let state: 'true' | 'false' | 'mixed' = 'false'

    const updateState = (newState: 'true' | 'false' | 'mixed') => {
      state = newState
      checkbox?.attr('aria-checked', state)
      symbol?.attr('aria-checked', state)
      host.setAttribute('aria-checked', state)
      
      trigger({ type: 'stateChange', detail: { state } })
      emit({ type: 'stateChange', detail: { state } })
    }

    const cycleState = () => {
      if (state === 'false') {
        updateState('true')
      } else if (state === 'true') {
        updateState('mixed')
      } else {
        updateState('false')
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
          const newState = newValue as 'true' | 'false' | 'mixed'
          if (newState !== state) {
            updateState(newState)
          }
        }
      },
      onConnected() {
        const attrValue = host.getAttribute('aria-checked')
        if (attrValue === 'true' || attrValue === 'mixed') {
          updateState(attrValue as 'true' | 'mixed')
        }
      },
    }
  },
})
```

#### Checkbox Group with Tri-State Parent

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'
import { FormCheckbox } from './form-checkbox'

const groupStyles = createStyles({
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
})

type CheckboxGroupEvents = {
  groupChange: { allChecked: boolean; someChecked: boolean; checkedCount: number }
}

export const CheckboxGroup = bElement<CheckboxGroupEvents>({
  tag: 'checkbox-group',
  shadowDom: (
    <div
      p-target='group'
      role='group'
      aria-labelledby='group-label'
      {...groupStyles.group}
    >
      <div
        p-target='label'
        id='group-label'
        {...groupStyles.label}
      >
        <slot name='label'>Install Options</slot>
      </div>
      <TriStateCheckbox
        p-target='select-all'
        p-trigger={{ stateChange: 'handleSelectAllChange' }}
      >
        <slot name='select-all-label'>Select all</slot>
      </TriStateCheckbox>
      <slot name='checkboxes'></slot>
    </div>
  ),
  bProgram({ $, emit }) {
    const group = $('group')[0]
    const selectAll = $('select-all')[0]
    let checkboxes: HTMLElement[] = []

    const getCheckboxStates = () => {
      const states = checkboxes.map((cb) => 
        cb.getAttribute('aria-checked') === 'true'
      )
      const checkedCount = states.filter(Boolean).length
      const allChecked = checkedCount === checkboxes.length
      const someChecked = checkedCount > 0 && checkedCount < checkboxes.length
      
      return { allChecked, someChecked, checkedCount }
    }

    const updateSelectAllState = () => {
      const { allChecked, someChecked } = getCheckboxStates()
      let newState: 'true' | 'false' | 'mixed' = 'false'
      
      if (allChecked) {
        newState = 'true'
      } else if (someChecked) {
        newState = 'mixed'
      }
      
      selectAll?.attr('aria-checked', newState)
    }

    const setAllCheckboxes = (checked: boolean) => {
      checkboxes.forEach((cb) => {
        cb.setAttribute('aria-checked', checked ? 'true' : 'false')
        // Trigger change event on each checkbox
        cb.dispatchEvent(new CustomEvent('change', { detail: { checked } }))
      })
      updateSelectAllState()
    }

    return {
      handleSelectAllChange(event: CustomEvent) {
        const state = event.detail.state as 'true' | 'false' | 'mixed'
        
        if (state === 'true') {
          setAllCheckboxes(true)
        } else if (state === 'false') {
          setAllCheckboxes(false)
        } else if (state === 'mixed') {
          // In some implementations, restore previous partial state
          // For simplicity, this example checks all
          setAllCheckboxes(true)
        }
        
        const { allChecked, someChecked, checkedCount } = getCheckboxStates()
        emit({
          type: 'groupChange',
          detail: { allChecked, someChecked, checkedCount },
        })
      },
      handleCheckboxChange() {
        updateSelectAllState()
        const { allChecked, someChecked, checkedCount } = getCheckboxStates()
        emit({
          type: 'groupChange',
          detail: { allChecked, someChecked, checkedCount },
        })
      },
      onConnected() {
        // Get checkboxes from slot
        const slot = group?.querySelector('slot[name="checkboxes"]') as HTMLSlotElement
        if (slot) {
          const assignedNodes = slot.assignedElements()
          checkboxes = assignedNodes.filter((node) => 
            node.hasAttribute('role') && node.getAttribute('role') === 'checkbox'
          ) as HTMLElement[]
          
          // Listen for changes on individual checkboxes
          checkboxes.forEach((cb) => {
            cb.addEventListener('change', () => {
              // Handle checkbox change
            })
          })
          
          updateSelectAllState()
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - form-associated checkboxes are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for click and keyboard events
  - `p-target` for element selection with `$()`
  - `attr()` helper for managing ARIA attributes
  - `observedAttributes` for reactive updates
  - `formAssociated: true` for form integration
  - `internals` for ElementInternals API (form values, states)
- **Requires external web API**: No - uses standard HTML elements and ARIA
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

- **Space**: Toggles checkbox state (checked ↔ unchecked)
- **Tri-state**: Cycles through false → true → mixed → false
- **Tab**: Moves focus to next focusable element
- **Shift + Tab**: Moves focus to previous focusable element

## WAI-ARIA Roles, States, and Properties

### Required

- **role="checkbox"**: Identifies the element as a checkbox
- **aria-checked**: Set to `"true"` when checked, `"false"` when unchecked, `"mixed"` for tri-state
- **Accessible label**: Provided via text content, `aria-label`, or `aria-labelledby`

### Optional

- **role="group"**: Container for checkbox groups with visible label
- **aria-labelledby**: On group container, references the label element
- **aria-describedby**: References element containing additional description
- **tabindex="0"**: For custom checkbox elements (native checkboxes don't need this)

## Best Practices

1. **Use native `<input type="checkbox">`** when possible - provides built-in accessibility
2. **Use Functional Templates** for static checkboxes in stories
3. **Use bElements** for form-associated checkboxes that need form integration
4. **Use bElements** for tri-state checkboxes that need complex state management
5. **Provide clear labels** - use descriptive text or `aria-label`
6. **Group related checkboxes** - use `role="group"` with `aria-labelledby`
7. **Handle Space key** - essential for keyboard accessibility
8. **Update tri-state based on group** - reflect group state accurately
9. **Use form association** - enable `formAssociated: true` for native form integration

## Accessibility Considerations

- Screen readers announce checkbox role, label, and checked state
- Keyboard users can toggle with Space key
- Tri-state checkboxes announce "partially checked" or "mixed" state
- Checkbox groups should have clear labels
- Focus indicators must be visible
- Disabled checkboxes should be clearly distinguishable

## Differences: Native vs Custom

| Feature | Native `<input type="checkbox">` | Custom with `role="checkbox"` |
|---------|----------------------------------|-------------------------------|
| Form integration | Automatic | Requires `formAssociated: true` |
| Keyboard support | Built-in | Must implement Space key handler |
| Styling | Limited | Full control |
| Tri-state | No (only true/false) | Yes (supports mixed) |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: Native HTML checkboxes and ARIA attributes have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
- MDN: [HTML input checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox)
- MDN: [ARIA checkbox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/checkbox_role)
