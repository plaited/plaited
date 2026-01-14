# ARIA Listbox Pattern

## Overview

A listbox widget presents a list of options and allows a user to select one or more of them. A listbox that allows a single option to be chosen is a single-select listbox; one that allows multiple options to be selected is a multi-select listbox.

**Key Characteristics:**
- **Single-select**: Only one option can be selected at a time
- **Multi-select**: Multiple options can be selected
- **Keyboard navigation**: Arrow keys, Home, End, type-ahead
- **Focus management**: Uses `aria-activedescendant` for virtual focus
- **Grouped options**: Supports option groups with `role="group"`
- **Selection state**: Indicated with `aria-selected` or `aria-checked`
- **Form association**: Can be form-associated for native form integration

**Important Notes:**
- Listbox does not support interactive elements (links, buttons, checkboxes) inside options
- Avoid very long option names for better screen reader usability
- Avoid options that start with the same word/phrase (consider multiple listboxes instead)

## Use Cases

- Form select inputs (replacement for native `<select>`)
- Multi-select lists (tags, categories, filters)
- Scrollable option lists
- Grouped options (categories, regions)
- Rearrangeable option lists
- Settings/preference selectors
- Data visualization filters

## Implementation

### Vanilla JavaScript

```html
<!-- Single-select listbox -->
<ul role="listbox" aria-label="Choose a country">
  <li role="option" aria-selected="false">United States</li>
  <li role="option" aria-selected="true">Canada</li>
  <li role="option" aria-selected="false">Mexico</li>
</ul>

<!-- Multi-select listbox -->
<ul role="listbox" aria-label="Choose countries" aria-multiselectable="true">
  <li role="option" aria-selected="false">United States</li>
  <li role="option" aria-selected="true">Canada</li>
  <li role="option" aria-selected="true">Mexico</li>
</ul>

<!-- Grouped options -->
<ul role="listbox" aria-label="Choose a city">
  <li role="group" aria-label="North America">
    <ul>
      <li role="option">New York</li>
      <li role="option">Toronto</li>
    </ul>
  </li>
  <li role="group" aria-label="Europe">
    <ul>
      <li role="option">London</li>
      <li role="option">Paris</li>
    </ul>
  </li>
</ul>
```

```javascript
// Keyboard navigation
listbox.addEventListener('keydown', (e) => {
  const options = Array.from(listbox.querySelectorAll('[role="option"]'))
  const currentIndex = options.findIndex(opt => opt === document.activeElement)
  
  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % options.length
      options[nextIndex].focus()
      break
    case 'ArrowUp':
      e.preventDefault()
      const prevIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1
      options[prevIndex].focus()
      break
    case 'Home':
      e.preventDefault()
      options[0].focus()
      break
    case 'End':
      e.preventDefault()
      options[options.length - 1].focus()
      break
  }
})

// Selection handling
function selectOption(option, isMultiSelect) {
  if (isMultiSelect) {
    const selected = option.getAttribute('aria-selected') === 'true'
    option.setAttribute('aria-selected', String(!selected))
  } else {
    // Unselect all others
    listbox.querySelectorAll('[role="option"]').forEach(opt => {
      opt.setAttribute('aria-selected', 'false')
    })
    option.setAttribute('aria-selected', 'true')
  }
}
```

### Plaited Adaptation

**Important**: In Plaited, listboxes are implemented as **bElements** because they require:
- Complex state management (selected options, focused option)
- Keyboard navigation (arrow keys, Home, End, type-ahead)
- Focus management with `aria-activedescendant`
- Form association (optional)
- Dynamic option rendering

#### Single-Select Listbox (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const listboxStyles = createStyles({
  listbox: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    outline: 'none',
  },
  option: {
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    backgroundColor: {
      $default: 'transparent',
      '[aria-selected="true"]': '#007bff',
      '[data-focused="true"]': '#f0f0f0',
      ':hover': '#f0f0f0',
    },
    color: {
      $default: 'inherit',
      '[aria-selected="true"]': 'white',
    },
  },
  group: {
    padding: '0.5rem 0',
  },
  groupLabel: {
    padding: '0.5rem 1rem',
    fontWeight: 'bold',
    fontSize: '0.875em',
    color: '#666',
  },
})

type ListboxEvents = {
  select: { value: string; index: number; option: HTMLElement }
  change: { value: string | string[] }
}

export const Listbox = bElement<ListboxEvents>({
  tag: 'accessible-listbox',
  observedAttributes: ['value', 'multiselectable', 'aria-label'],
  formAssociated: true,
  shadowDom: (
    <ul
      p-target='listbox'
      role='listbox'
      tabIndex={0}
      {...listboxStyles.listbox}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <slot name='options'></slot>
    </ul>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const listbox = $('listbox')[0]
    let options: HTMLElement[] = []
    let selectedIndex = -1
    let focusedIndex = -1
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined
    const isMultiSelect = host.getAttribute('aria-multiselectable') === 'true'

    const getOptions = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="option"]')
      ) as HTMLElement[]
    }

    const updateActiveDescendant = () => {
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        const focusedOption = options[focusedIndex]
        const id = focusedOption.id || `option-${focusedIndex}`
        if (!focusedOption.id) {
          focusedOption.id = id
        }
        listbox?.attr('aria-activedescendant', id)
        focusedOption.setAttribute('data-focused', 'true')
      } else {
        listbox?.attr('aria-activedescendant', null)
      }
      
      // Remove focus from other options
      options.forEach((opt, idx) => {
        if (idx !== focusedIndex) {
          opt.removeAttribute('data-focused')
        }
      })
    }

    const selectOption = (index: number, toggle = false) => {
      if (index < 0 || index >= options.length) return
      
      const option = options[index]
      const value = option.getAttribute('data-value') || option.textContent || ''
      
      if (isMultiSelect) {
        if (toggle) {
          const currentlySelected = option.getAttribute('aria-selected') === 'true'
          option.attr('aria-selected', currentlySelected ? 'false' : 'true')
        } else {
          option.attr('aria-selected', 'true')
        }
      } else {
        // Single-select: unselect all others
        options.forEach(opt => opt.attr('aria-selected', 'false'))
        option.attr('aria-selected', 'true')
        selectedIndex = index
      }
      
      emit({
        type: 'select',
        detail: { value, index, option },
      })
      
      updateFormValue()
    }

    const updateFormValue = () => {
      const selectedOptions = options.filter(
        opt => opt.getAttribute('aria-selected') === 'true'
      )
      const values = selectedOptions.map(
        opt => opt.getAttribute('data-value') || opt.textContent || ''
      )
      
      if (isMultiSelect) {
        internals.setFormValue(JSON.stringify(values))
        emit({ type: 'change', detail: { value: values } })
      } else {
        const value = values[0] || ''
        internals.setFormValue(value)
        emit({ type: 'change', detail: { value } })
      }
    }

    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      if (options.length === 0) return
      
      let newIndex = focusedIndex
      
      switch (direction) {
        case 'next':
          newIndex = (focusedIndex + 1) % options.length
          break
        case 'prev':
          newIndex = focusedIndex <= 0 ? options.length - 1 : focusedIndex - 1
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = options.length - 1
          break
      }
      
      focusedIndex = newIndex
      updateActiveDescendant()
      
      // Scroll into view
      options[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }

    const handleTypeAhead = (char: string) => {
      typeAheadBuffer += char.toLowerCase()
      
      // Clear timeout
      if (typeAheadTimeout) {
        clearTimeout(typeAheadTimeout)
      }
      
      // Find next option starting with buffer
      const startIndex = (focusedIndex + 1) % options.length
      let foundIndex = -1
      
      // Search from current position to end
      for (let i = startIndex; i < options.length; i++) {
        const text = (options[i].textContent || '').toLowerCase()
        if (text.startsWith(typeAheadBuffer)) {
          foundIndex = i
          break
        }
      }
      
      // If not found, search from beginning
      if (foundIndex === -1) {
        for (let i = 0; i < startIndex; i++) {
          const text = (options[i].textContent || '').toLowerCase()
          if (text.startsWith(typeAheadBuffer)) {
            foundIndex = i
            break
          }
        }
      }
      
      if (foundIndex >= 0) {
        focusedIndex = foundIndex
        updateActiveDescendant()
        options[focusedIndex]?.scrollIntoView({ block: 'nearest' })
      }
      
      // Clear buffer after delay
      typeAheadTimeout = setTimeout(() => {
        typeAheadBuffer = ''
      }, 1000)
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        if (options.length === 0) return
        
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            moveFocus('next')
            if (!isMultiSelect) {
              // Selection follows focus in single-select
              selectOption(focusedIndex, false)
            }
            break
            
          case 'ArrowUp':
            event.preventDefault()
            moveFocus('prev')
            if (!isMultiSelect) {
              selectOption(focusedIndex, false)
            }
            break
            
          case 'Home':
            event.preventDefault()
            moveFocus('first')
            if (!isMultiSelect) {
              selectOption(focusedIndex, false)
            }
            break
            
          case 'End':
            event.preventDefault()
            moveFocus('last')
            if (!isMultiSelect) {
              selectOption(focusedIndex, false)
            }
            break
            
          case ' ': // Space
            if (isMultiSelect) {
              event.preventDefault()
              selectOption(focusedIndex, true)
            }
            break
            
          case 'Enter':
            event.preventDefault()
            if (isMultiSelect) {
              selectOption(focusedIndex, true)
            } else {
              selectOption(focusedIndex, false)
            }
            break
            
          default:
            // Type-ahead: single character
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
              event.preventDefault()
              handleTypeAhead(event.key)
            }
            break
        }
      },
      
      handleFocus() {
        options = getOptions()
        
        if (options.length === 0) return
        
        // If no option is selected, focus first option
        if (selectedIndex < 0) {
          focusedIndex = 0
        } else {
          focusedIndex = selectedIndex
        }
        
        updateActiveDescendant()
      },
      
      handleBlur() {
        // Clear type-ahead buffer
        if (typeAheadTimeout) {
          clearTimeout(typeAheadTimeout)
          typeAheadTimeout = undefined
        }
        typeAheadBuffer = ''
      },
      
      onConnected() {
        options = getOptions()
        
        // Initialize from value attribute
        const value = host.getAttribute('value')
        if (value) {
          if (isMultiSelect) {
            try {
              const values = JSON.parse(value)
              options.forEach((opt, idx) => {
                const optValue = opt.getAttribute('data-value') || opt.textContent || ''
                if (values.includes(optValue)) {
                  opt.attr('aria-selected', 'true')
                  if (selectedIndex < 0) selectedIndex = idx
                }
              })
            } catch {
              // Invalid JSON, ignore
            }
          } else {
            options.forEach((opt, idx) => {
              const optValue = opt.getAttribute('data-value') || opt.textContent || ''
              if (optValue === value) {
                opt.attr('aria-selected', 'true')
                selectedIndex = idx
              }
            })
          }
        }
        
        // Set aria-multiselectable
        if (isMultiSelect) {
          listbox?.attr('aria-multiselectable', 'true')
        }
        
        // Set aria-label if provided
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          listbox?.attr('aria-label', ariaLabel)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          options = getOptions()
          if (isMultiSelect) {
            try {
              const values = JSON.parse(newValue)
              options.forEach(opt => {
                const optValue = opt.getAttribute('data-value') || opt.textContent || ''
                opt.attr('aria-selected', values.includes(optValue) ? 'true' : 'false')
              })
            } catch {
              // Invalid JSON
            }
          } else {
            options.forEach(opt => {
              const optValue = opt.getAttribute('data-value') || opt.textContent || ''
              opt.attr('aria-selected', optValue === newValue ? 'true' : 'false')
            })
          }
          updateFormValue()
        } else if (name === 'aria-label') {
          listbox?.attr('aria-label', newValue || null)
        }
      },
      
      onDisconnected() {
        if (typeAheadTimeout) {
          clearTimeout(typeAheadTimeout)
        }
      },
    }
  },
})
```

#### Multi-Select Listbox (bElement)

The same `Listbox` bElement supports multi-select when `aria-multiselectable="true"` is set:

```typescript
// Usage in story
export const multiSelectListbox = story({
  intent: 'Multi-select listbox',
  template: () => (
    <Listbox aria-multiselectable='true' aria-label='Choose countries'>
      <li slot='options' role='option' data-value='us' aria-selected='false'>
        United States
      </li>
      <li slot='options' role='option' data-value='ca' aria-selected='true'>
        Canada
      </li>
      <li slot='options' role='option' data-value='mx' aria-selected='true'>
        Mexico
      </li>
    </Listbox>
  ),
})
```

#### Listbox with Grouped Options

```typescript
// Option Group Component (Functional Template)
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'

const OptionGroup: FT<{
  'aria-label': string
  children?: Children
}> = ({ 'aria-label': ariaLabel, children, ...attrs }) => (
  <li role='group' aria-label={ariaLabel} {...attrs} {...joinStyles(listboxStyles.group)}>
    <div {...listboxStyles.groupLabel}>{ariaLabel}</div>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {children}
    </ul>
  </li>
)

// Usage
export const groupedListbox = story({
  intent: 'Listbox with grouped options',
  template: () => (
    <Listbox aria-label='Choose a city'>
      <OptionGroup aria-label='North America' slot='options'>
        <li role='option' data-value='ny' aria-selected='false'>New York</li>
        <li role='option' data-value='toronto' aria-selected='false'>Toronto</li>
      </OptionGroup>
      <OptionGroup aria-label='Europe' slot='options'>
        <li role='option' data-value='london' aria-selected='false'>London</li>
        <li role='option' data-value='paris' aria-selected='false'>Paris</li>
      </OptionGroup>
    </Listbox>
  ),
})
```

#### Option Component (Functional Template)

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'

const Option: FT<{
  value?: string
  'aria-selected': 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-selected': ariaSelected, children, ...attrs }) => (
  <li
    role='option'
    data-value={value}
    aria-selected={ariaSelected}
    {...attrs}
    {...joinStyles(listboxStyles.option)}
    p-trigger={{ click: 'selectOptionClick' }}
  >
    {children}
  </li>
)

// Usage in bElement
bElement({
  tag: 'listbox-with-options',
  shadowDom: (
    <Listbox p-target='listbox' aria-label='Choose an option'>
      <Option slot='options' value='opt1' aria-selected='false'>Option 1</Option>
      <Option slot='options' value='opt2' aria-selected='false'>Option 2</Option>
    </Listbox>
  ),
  bProgram({ $, trigger }) {
    const listbox = $('listbox')[0]
    
    return {
      selectOptionClick(event: { target: HTMLElement }) {
        // Option clicked - listbox will handle selection via event
        const option = event.target.closest('[role="option"]') as HTMLElement
        if (option) {
          // Trigger selection in listbox
          const index = Array.from(
            listbox?.querySelectorAll('[role="option"]') || []
          ).indexOf(option)
          if (index >= 0) {
            // Dispatch custom event or use listbox's internal method
            option.click() // Native click will be handled by listbox
          }
        }
      },
    }
  },
})
```

#### Scrollable Listbox

```typescript
// Add scroll styles
const scrollableListboxStyles = createStyles({
  listbox: {
    ...listboxStyles.listbox,
    maxHeight: '200px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
})

// The listbox automatically scrolls focused options into view
// using scrollIntoView({ block: 'nearest' })
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - listbox uses Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `p-trigger` for events
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: Yes - type-ahead timeout cleanup in `onDisconnected`

## Keyboard Interaction

### Single-Select Listbox

- **ArrowDown**: Moves focus to next option (selection follows focus)
- **ArrowUp**: Moves focus to previous option (selection follows focus)
- **Home**: Moves focus to first option (selection follows focus)
- **End**: Moves focus to last option (selection follows focus)
- **Enter**: Selects focused option
- **Type-ahead**: Type character(s) to jump to option starting with that text

### Multi-Select Listbox

- **ArrowDown**: Moves focus to next option (does not change selection)
- **ArrowUp**: Moves focus to previous option (does not change selection)
- **Home**: Moves focus to first option
- **End**: Moves focus to last option
- **Space**: Toggles selection state of focused option
- **Enter**: Toggles selection state of focused option
- **Type-ahead**: Type character(s) to jump to option starting with that text

**Note**: The implementation above uses the recommended model where modifier keys are not required. For the alternative model (requiring Shift/Control), additional keyboard handlers would be needed.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="listbox"**: Container element
- **role="option"**: Each selectable option
- **aria-selected** or **aria-checked**: Selection state (`true`/`false`)

### Optional

- **aria-multiselectable**: Set to `true` for multi-select (default: `false`)
- **aria-label** or **aria-labelledby**: Accessible name for listbox
- **aria-activedescendant**: ID of currently focused option (for virtual focus)
- **aria-orientation**: `horizontal` for horizontal layout (default: `vertical`)
- **role="group"**: For option groups
- **aria-label** on groups: Accessible name for option group
- **aria-setsize**: Total number of options (for dynamic loading)
- **aria-posinset**: Position of option in set (for dynamic loading)

### Selection State

- Use `aria-selected` for single-select widgets (recommended)
- Use `aria-checked` for multi-select widgets (alternative convention)
- Do not use both `aria-selected` and `aria-checked` in the same listbox

## Best Practices

1. **Use bElement** - Listboxes require complex state and keyboard handling
2. **Virtual focus** - Use `aria-activedescendant` instead of moving DOM focus
3. **Type-ahead** - Implement for lists with more than 7 options
4. **Short option names** - Avoid very long option text
5. **Unique prefixes** - Avoid options starting with same word/phrase
6. **Scroll into view** - Ensure focused options are visible
7. **Form association** - Use `formAssociated: true` for form integration
8. **Group labels** - Always provide `aria-label` for option groups
9. **Selection feedback** - Clear visual indication of selected options
10. **Keyboard shortcuts** - Support Home/End for lists with 5+ options

## Accessibility Considerations

- Screen readers announce option names, states, and positions
- Keyboard users can navigate without mouse
- Focus indicators must be visible
- Selected state must be clearly indicated
- Type-ahead improves efficiency for long lists
- Grouped options help organize related choices
- Virtual focus (`aria-activedescendant`) keeps DOM focus on listbox container

## Listbox Variants

### Single-Select
- Only one option selected at a time
- Selection follows focus (optional)
- Use `aria-selected` for selection state

### Multi-Select
- Multiple options can be selected
- Selection independent of focus
- Use `aria-selected` or `aria-checked`
- Space/Enter toggles selection

### Grouped Options
- Options organized into groups
- Groups have accessible names
- Helps organize related options
- Similar to HTML `<optgroup>`

### Scrollable Listbox
- Fixed height with scroll
- Similar to HTML `<select size>`
- Auto-scrolls focused option into view

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA listbox pattern has universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
- MDN: [ARIA listbox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/listbox_role)
- MDN: [ARIA option role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/option_role)
- MDN: [Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant)
- Related: [Combobox Pattern](./aria-combobox-pattern.md) - Uses listbox as popup
