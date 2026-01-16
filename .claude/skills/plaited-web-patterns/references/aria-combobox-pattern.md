# ARIA Combobox Pattern

## Overview

A combobox is an input widget that has an associated popup. The popup enables users to choose a value for the input from a collection. The popup may be a listbox, grid, tree, or dialog.

**Key Characteristics:**

- **Select-only**: No text input, similar to HTML `<select>`
- **Editable**: Allows text input, may filter suggestions
- **Autocomplete behaviors**: None, list (manual/automatic), or both (with inline)
- **Popup types**: Listbox (most common), grid, tree, or dialog
- **Focus management**: Uses `aria-activedescendant` for popup navigation

**Autocomplete Types:**

1. **None**: Same suggestions regardless of input
2. **List (manual)**: Suggestions filter based on input, user must select
3. **List (automatic)**: First suggestion auto-selected, becomes value on blur
4. **Both**: Automatic selection + inline completion string

## Use Cases

- Location/address input with suggestions
- Search fields with previous searches
- Form inputs with predefined allowed values
- Tag/autocomplete inputs
- Date/time pickers
- Multi-column data selection (grid popup)

## Implementation

### Vanilla JavaScript

```html
<!-- Select-only combobox -->
<div role="combobox" aria-expanded="false" aria-controls="listbox" aria-haspopup="listbox">
  <input type="text" readonly value="Choose an option" aria-label="Select option">
  <button aria-label="Open options">▼</button>
</div>
<ul role="listbox" id="listbox" hidden>
  <li role="option" aria-selected="false">Option 1</li>
  <li role="option" aria-selected="false">Option 2</li>
</ul>

<!-- Editable combobox -->
<input 
  type="text"
  role="combobox"
  aria-expanded="false"
  aria-controls="suggestions"
  aria-autocomplete="list"
  aria-label="Search"
>
<ul role="listbox" id="suggestions" hidden>
  <li role="option">Suggestion 1</li>
</ul>
```

### Plaited Adaptation

**Important**: In Plaited, comboboxes are implemented as **bElements** because they require:

- Complex state management (open/closed, selected option, input value)
- Focus management with `aria-activedescendant`
- Keyboard navigation (arrow keys, Enter, Escape)
- Popup positioning and visibility
- Form association (optional)

#### Select-Only Combobox (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const comboboxStyles = createStyles({
  combobox: {
    position: 'relative',
    display: 'inline-flex',
    inlineSize: '100%',
    maxInlineSize: '300px',
  },
  input: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderStartStartRadius: '4px',
    borderStartEndRadius: '0',
    borderEndEndRadius: '0',
    borderEndStartRadius: '4px',
  },
  button: {
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderInlineStart: 'none',
    borderStartStartRadius: '0',
    borderStartEndRadius: '4px',
    borderEndEndRadius: '4px',
    borderEndStartRadius: '0',
    background: 'white',
    cursor: 'pointer',
  },
  listbox: {
    position: 'absolute',
    insetBlockStart: '100%',
    insetInlineStart: 0,
    insetInlineEnd: 0,
    marginBlockStart: '0.25rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: 'white',
    maxBlockSize: '200px',
    overflowY: 'auto',
    listStyle: 'none',
    padding: 0,
    zIndex: 1000,
    display: {
      $default: 'none',
      '[data-open="true"]': 'block',
    },
  },
  option: {
    padding: '0.5rem',
    cursor: 'pointer',
    backgroundColor: {
      $default: 'transparent',
      '[aria-selected="true"]': '#007bff',
      ':hover': '#f0f0f0',
    },
  },
})

type ComboboxEvents = {
  select: { value: string; index: number }
  change: { value: string }
}

export const SelectCombobox = bElement<ComboboxEvents>({
  tag: 'select-combobox',
  observedAttributes: ['value'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='combobox'
      role='combobox'
      aria-expanded='false'
      aria-controls='listbox'
      aria-haspopup='listbox'
      {...comboboxStyles.combobox}
    >
      <input
        type='text'
        p-target='input'
        readonly
        aria-label='Select option'
        {...comboboxStyles.input}
        p-trigger={{ keydown: 'handleInputKeydown', focus: 'handleFocus' }}
      />
      <button
        type='button'
        p-target='toggle-button'
        aria-label='Open options'
        {...comboboxStyles.button}
        p-trigger={{ click: 'togglePopup' }}
      >
        ▼
      </button>
      <ul
        p-target='listbox'
        role='listbox'
        id='listbox'
        data-open='false'
        {...comboboxStyles.listbox}
        p-trigger={{ keydown: 'handleListboxKeydown' }}
      >
        <slot name='options'></slot>
      </ul>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const combobox = $('combobox')[0]
    const input = $<HTMLInputElement>('input')[0]
    const listbox = $('listbox')[0]
    let options: HTMLElement[] = []
    let selectedIndex = -1
    let isOpen = false

    const openPopup = () => {
      isOpen = true
      combobox?.attr('aria-expanded', 'true')
      listbox?.attr('data-open', 'true')
      listbox?.attr('hidden', null)
      
      // Focus first option if none selected
      if (selectedIndex === -1 && options.length > 0) {
        selectedIndex = 0
        updateActiveOption()
      }
    }

    const closePopup = () => {
      isOpen = false
      combobox?.attr('aria-expanded', 'false')
      listbox?.attr('data-open', 'false')
      listbox?.attr('hidden', '')
      combobox?.attr('aria-activedescendant', null)
    }

    const updateActiveOption = () => {
      options.forEach((option, index) => {
        const isSelected = index === selectedIndex
        option.attr('aria-selected', isSelected ? 'true' : 'false')
        option.attr('id', `option-${index}`)
      })
      
      if (selectedIndex >= 0 && options[selectedIndex]) {
        combobox?.attr('aria-activedescendant', `option-${selectedIndex}`)
        // Scroll into view
        options[selectedIndex]?.scrollIntoView({ block: 'nearest' })
      }
    }

    const selectOption = (index: number) => {
      if (index < 0 || index >= options.length) return
      
      selectedIndex = index
      const option = options[index]
      const value = option.textContent?.trim() || ''
      
      input?.attr('value', value)
      host.setAttribute('value', value)
      internals.setFormValue(value)
      
      closePopup()
      input?.focus()
      
      emit({ type: 'select', detail: { value, index } })
      emit({ type: 'change', detail: { value } })
    }

    return {
      togglePopup() {
        if (isOpen) {
          closePopup()
        } else {
          openPopup()
        }
      },
      handleFocus() {
        // Open on focus for select-only
        if (!isOpen) {
          openPopup()
        }
      },
      handleInputKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            if (!isOpen) {
              openPopup()
            } else {
              selectedIndex = Math.min(selectedIndex + 1, options.length - 1)
              updateActiveOption()
            }
            break
          case 'ArrowUp':
            event.preventDefault()
            if (isOpen) {
              selectedIndex = Math.max(selectedIndex - 1, 0)
              updateActiveOption()
            }
            break
          case 'Enter':
            event.preventDefault()
            if (isOpen && selectedIndex >= 0) {
              selectOption(selectedIndex)
            }
            break
          case 'Escape':
            event.preventDefault()
            if (isOpen) {
              closePopup()
            }
            break
        }
      },
      handleListboxKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            selectedIndex = Math.min(selectedIndex + 1, options.length - 1)
            updateActiveOption()
            break
          case 'ArrowUp':
            event.preventDefault()
            selectedIndex = Math.max(selectedIndex - 1, 0)
            updateActiveOption()
            break
          case 'Enter':
            event.preventDefault()
            if (selectedIndex >= 0) {
              selectOption(selectedIndex)
            }
            break
          case 'Escape':
            event.preventDefault()
            closePopup()
            input?.focus()
            break
        }
      },
      onConnected() {
        // Initialize options from slot
        const slot = listbox?.querySelector('slot[name="options"]') as HTMLSlotElement
        if (slot) {
          const assignedNodes = slot.assignedElements()
          options = assignedNodes.filter((node) => 
            node.hasAttribute('role') && node.getAttribute('role') === 'option'
          ) as HTMLElement[]
          
          // Set up option click handlers
          options.forEach((option, index) => {
            option.setAttribute('p-trigger', JSON.stringify({ click: 'selectOptionClick' }))
            option.setAttribute('data-index', String(index))
          })
        }
        
        // Initialize value from attribute
        const value = host.getAttribute('value')
        if (value && input) {
          input.attr('value', value)
        }
      },
    }
  },
})
```

#### Editable Combobox with List Autocomplete (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const editableComboboxStyles = createStyles({
  combobox: {
    position: 'relative',
    display: 'inline-flex',
    inlineSize: '100%',
    maxInlineSize: '300px',
  },
  input: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  listbox: {
    position: 'absolute',
    insetBlockStart: '100%',
    insetInlineStart: 0,
    insetInlineEnd: 0,
    marginBlockStart: '0.25rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: 'white',
    maxBlockSize: '200px',
    overflowY: 'auto',
    listStyle: 'none',
    padding: 0,
    zIndex: 1000,
    display: {
      $default: 'none',
      '[data-open="true"]': 'block',
    },
  },
  option: {
    padding: '0.5rem',
    cursor: 'pointer',
    backgroundColor: {
      $default: 'transparent',
      '[aria-selected="true"]': '#007bff',
      ':hover': '#f0f0f0',
    },
  },
})

type EditableComboboxEvents = {
  input: { value: string }
  select: { value: string; index: number }
  change: { value: string }
}

export const EditableCombobox = bElement<EditableComboboxEvents>({
  tag: 'editable-combobox',
  observedAttributes: ['value', 'aria-autocomplete'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='combobox'
      role='combobox'
      aria-expanded='false'
      aria-controls='listbox'
      aria-autocomplete='list'
      {...editableComboboxStyles.combobox}
    >
      <input
        type='text'
        p-target='input'
        aria-label='Search'
        {...editableComboboxStyles.input}
        p-trigger={{ 
          input: 'handleInput',
          keydown: 'handleInputKeydown',
          focus: 'handleFocus',
          blur: 'handleBlur'
        }}
      />
      <ul
        p-target='listbox'
        role='listbox'
        id='listbox'
        data-open='false'
        {...editableComboboxStyles.listbox}
      >
        {/* Options will be dynamically rendered */}
      </ul>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const combobox = $('combobox')[0]
    const input = $<HTMLInputElement>('input')[0]
    const listbox = $('listbox')[0]
    
    let allOptions: string[] = []
    let filteredOptions: string[] = []
    let selectedIndex = -1
    let isOpen = false
    let inputValue = ''

    const filterOptions = (query: string) => {
      if (!query.trim()) {
        filteredOptions = allOptions
      } else {
        filteredOptions = allOptions.filter((option) =>
          option.toLowerCase().includes(query.toLowerCase())
        )
      }
      renderOptions()
    }

    const renderOptions = () => {
      if (!listbox) return
      
      listbox.render(
        ...filteredOptions.map((option, index) => (
          <li
            key={index}
            role='option'
            aria-selected={index === selectedIndex ? 'true' : 'false'}
            id={`option-${index}`}
            data-value={option}
            p-trigger={{ click: 'selectOptionClick', mouseenter: 'handleOptionHover' }}
            {...editableComboboxStyles.option}
          >
            {option}
          </li>
        ))
      )
      
      updateActiveOption()
    }

    const updateActiveOption = () => {
      if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
        combobox?.attr('aria-activedescendant', `option-${selectedIndex}`)
        const optionElement = listbox?.querySelector(`#option-${selectedIndex}`)
        optionElement?.scrollIntoView({ block: 'nearest' })
      } else {
        combobox?.attr('aria-activedescendant', null)
      }
    }

    const openPopup = () => {
      if (filteredOptions.length === 0) return
      
      isOpen = true
      combobox?.attr('aria-expanded', 'true')
      listbox?.attr('data-open', 'true')
      listbox?.attr('hidden', null)
      
      // Auto-select first option if aria-autocomplete includes automatic selection
      const autocomplete = host.getAttribute('aria-autocomplete')
      if (autocomplete === 'list' || autocomplete === 'both') {
        selectedIndex = 0
        updateActiveOption()
      }
    }

    const closePopup = () => {
      isOpen = false
      combobox?.attr('aria-expanded', 'false')
      listbox?.attr('data-open', 'false')
      listbox?.attr('hidden', '')
      combobox?.attr('aria-activedescendant', null)
      selectedIndex = -1
    }

    const selectOption = (index: number) => {
      if (index < 0 || index >= filteredOptions.length) return
      
      const value = filteredOptions[index]
      inputValue = value
      input?.attr('value', value)
      host.setAttribute('value', value)
      internals.setFormValue(value)
      
      closePopup()
      input?.focus()
      
      emit({ type: 'select', detail: { value, index } })
      emit({ type: 'change', detail: { value } })
    }

    return {
      handleInput(event: Event) {
        const target = event.target as HTMLInputElement
        inputValue = target.value
        filterOptions(inputValue)
        
        if (filteredOptions.length > 0 && inputValue.length > 0) {
          openPopup()
        } else {
          closePopup()
        }
        
        emit({ type: 'input', detail: { value: inputValue } })
      },
      handleFocus() {
        // Open popup on focus if there are suggestions
        if (filteredOptions.length > 0) {
          openPopup()
        }
      },
      handleBlur() {
        // Close popup on blur
        // In automatic selection mode, accept selected value
        const autocomplete = host.getAttribute('aria-autocomplete')
        if (autocomplete === 'list' || autocomplete === 'both') {
          if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
            selectOption(selectedIndex)
          }
        } else {
          closePopup()
        }
      },
      handleInputKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            if (!isOpen && filteredOptions.length > 0) {
              openPopup()
            } else if (isOpen) {
              selectedIndex = Math.min(selectedIndex + 1, filteredOptions.length - 1)
              updateActiveOption()
            }
            break
          case 'ArrowUp':
            event.preventDefault()
            if (isOpen) {
              selectedIndex = Math.max(selectedIndex - 1, 0)
              updateActiveOption()
            }
            break
          case 'Enter':
            event.preventDefault()
            if (isOpen && selectedIndex >= 0) {
              selectOption(selectedIndex)
            }
            break
          case 'Escape':
            event.preventDefault()
            closePopup()
            break
        }
      },
      handleOptionHover(event: { target: HTMLElement }) {
        const option = event.target
        const index = parseInt(option.getAttribute('data-index') || '-1', 10)
        if (index >= 0) {
          selectedIndex = index
          updateActiveOption()
        }
      },
      selectOptionClick(event: { target: HTMLElement }) {
        const option = event.target
        const index = parseInt(option.getAttribute('data-index') || '-1', 10)
        if (index >= 0) {
          selectOption(index)
        }
      },
      onConnected() {
        // Initialize options (could come from attribute, slot, or external source)
        const optionsAttr = host.getAttribute('options')
        if (optionsAttr) {
          try {
            allOptions = JSON.parse(optionsAttr)
            filteredOptions = allOptions
            renderOptions()
          } catch {
            // Invalid JSON
          }
        }
        
        // Initialize value
        const value = host.getAttribute('value')
        if (value && input) {
          input.attr('value', value)
          inputValue = value
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - comboboxes are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for input events, keyboard events, clicks
  - `p-target` for element selection with `$()`
  - `render()` helper for dynamic option rendering
  - `attr()` helper for managing ARIA attributes and focus
  - `observedAttributes` for reactive updates
  - `formAssociated: true` for form integration (optional)
  - `internals` for ElementInternals API
- **Requires external web API**: 
  - Focus management APIs (`focus()`, `aria-activedescendant`)
  - Keyboard event handling
  - Popup positioning (CSS or JavaScript)
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Combobox Input

- **Tab**: Moves focus to next element
- **Arrow Down**: Opens popup or moves to next option
- **Arrow Up**: Moves to previous option (if open)
- **Enter**: Accepts selected option
- **Escape**: Closes popup
- **Printable characters**: Types in editable combobox, filters options
- **(Alt/Opt) + Down Arrow**: Opens popup without moving focus
- **(Alt/Opt) + Up Arrow**: Closes popup, returns focus

### Listbox Popup

- **Arrow Down/Up**: Moves focus and selection
- **Enter**: Accepts option, closes popup
- **Escape**: Closes popup, returns focus
- **Home/End**: First/last option
- **Printable characters**: Returns focus to input (editable) or moves to matching option

## WAI-ARIA Roles, States, and Properties

### Required

- **role="combobox"**: On the input/container element
- **aria-expanded**: `"true"` when popup is open, `"false"` when closed
- **aria-controls**: ID reference to popup element
- **aria-haspopup**: Popup type (`listbox`, `grid`, `tree`, `dialog`) - `listbox` is implicit
- **role="listbox"**: On popup container (or `grid`, `tree`, `dialog`)
- **role="option"**: On each option element

### Optional

- **aria-autocomplete**: `"none"`, `"list"`, or `"both"`
- **aria-activedescendant**: ID reference to active option in popup
- **aria-selected**: `"true"` on selected option
- **aria-label** or **aria-labelledby**: Accessible label for combobox
- **aria-required**: `"true"` if value is required

## Best Practices

1. **Use bElement** - Comboboxes require complex state and focus management
2. **Maintain DOM focus on combobox** - Use `aria-activedescendant` for popup navigation
3. **Handle all keyboard interactions** - Arrow keys, Enter, Escape, printable characters
4. **Filter options dynamically** - For editable comboboxes with autocomplete
5. **Auto-select first option** - For automatic selection modes
6. **Close on blur** - Or accept selected value in automatic mode
7. **Scroll active option into view** - Ensure visibility during keyboard navigation
8. **Support form association** - Use `formAssociated: true` for native form integration
9. **Provide clear labels** - Use `aria-label` or `aria-labelledby`

## Accessibility Considerations

- Screen readers announce combobox role, label, value, and expanded state
- Keyboard users can navigate options without mouse
- Focus management ensures predictable navigation
- `aria-activedescendant` enables screen reader navigation in popup
- Selected options are clearly indicated visually and programmatically
- Popup positioning should not obscure content

## Autocomplete Behaviors

| Type | aria-autocomplete | Behavior |
|------|-------------------|----------|
| None | `"none"` | Same suggestions regardless of input |
| List (manual) | `"list"` | Suggestions filter, user must select |
| List (automatic) | `"list"` | First suggestion auto-selected, becomes value on blur |
| Both | `"both"` | Automatic + inline completion string |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA combobox pattern and `aria-activedescendant` have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- Related: [Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
- MDN: [ARIA combobox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/combobox_role)
- MDN: [aria-activedescendant](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-activedescendant)
