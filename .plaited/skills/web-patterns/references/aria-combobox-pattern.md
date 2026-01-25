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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

**File Structure:**

```
combobox/
  combobox.css.ts        # Styles (createStyles) - ALWAYS separate
  combobox.stories.tsx   # bElement + stories (imports from css.ts)
```

#### combobox.css.ts

```typescript
// combobox.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'inline-block',
  position: 'relative',
})

export const styles = createStyles({
  combobox: {
    position: 'relative',
    display: 'inline-flex',
    inlineSize: '100%',
  },
  input: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  inputWithButton: {
    borderStartEndRadius: 0,
    borderEndEndRadius: 0,
  },
  button: {
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderInlineStart: 'none',
    borderStartEndRadius: '4px',
    borderEndEndRadius: '4px',
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
    margin: 0,
    zIndex: 1000,
    display: 'none',
  },
  listboxOpen: {
    display: 'block',
  },
  option: {
    padding: '0.5rem',
    cursor: 'pointer',
  },
  optionSelected: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  optionHover: {
    backgroundColor: '#f0f0f0',
  },
})
```

#### combobox.stories.tsx

```typescript
// combobox.stories.tsx
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './combobox.css.ts'

// bElement for select-only combobox - defined locally, NOT exported
const SelectCombobox = bElement({
  tag: 'pattern-select-combobox',
  observedAttributes: ['value'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div p-target="wrapper" {...styles.combobox}>
      <input
        type="text"
        p-target="input"
        readonly
        aria-label="Select option"
        role="combobox"
        aria-expanded="false"
        aria-controls="listbox"
        aria-haspopup="listbox"
        p-trigger={{ click: 'togglePopup', keydown: 'handleInputKeydown', focus: 'openPopup' }}
        {...styles.input}
        {...styles.inputWithButton}
      />
      <button
        type="button"
        p-target="toggle-button"
        aria-label="Open options"
        tabIndex={-1}
        p-trigger={{ click: 'togglePopup' }}
        {...styles.button}
      >
        ▼
      </button>
      <ul
        p-target="listbox"
        role="listbox"
        id="listbox"
        {...styles.listbox}
      >
        <slot p-target="slot"></slot>
      </ul>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const input = $<HTMLInputElement>('input')[0]
    const listbox = $('listbox')[0]

    let options: Element[] = []
    let selectedIndex = -1
    let isOpen = false

    const getOptions = () => {
      const slot = listbox?.root.querySelector('slot') as HTMLSlotElement
      if (!slot) return []
      return slot.assignedElements().filter((el) => el.getAttribute('role') === 'option')
    }

    const openPopup = () => {
      if (isOpen) return
      isOpen = true
      input?.attr('aria-expanded', 'true')
      listbox?.attr('class', `${styles.listbox.classNames.join(' ')} ${styles.listboxOpen.classNames.join(' ')}`)

      if (selectedIndex === -1 && options.length > 0) {
        selectedIndex = 0
        updateActiveOption()
      }
    }

    const closePopup = () => {
      if (!isOpen) return
      isOpen = false
      input?.attr('aria-expanded', 'false')
      listbox?.attr('class', styles.listbox.classNames.join(' '))
      input?.attr('aria-activedescendant', null)
    }

    const updateActiveOption = () => {
      options.forEach((option, index) => {
        const el = option as HTMLElement
        const isSelected = index === selectedIndex
        el.setAttribute('aria-selected', isSelected ? 'true' : 'false')
        el.id = `option-${index}`

        if (isSelected) {
          el.classList.add(...styles.optionSelected.classNames)
        } else {
          el.classList.remove(...styles.optionSelected.classNames)
        }
      })

      if (selectedIndex >= 0 && options[selectedIndex]) {
        input?.attr('aria-activedescendant', `option-${selectedIndex}`)
        ;(options[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' })
      }
    }

    const selectOption = (index: number) => {
      if (index < 0 || index >= options.length) return

      selectedIndex = index
      const option = options[index] as HTMLElement
      const value = option.textContent?.trim() || ''

      input?.attr('value', value)
      host.setAttribute('value', value)
      internals.setFormValue(value)

      closePopup()
      input?.root.focus()

      emit({ type: 'change', detail: { value, index } })
    }

    return {
      openPopup,
      togglePopup() {
        if (isOpen) {
          closePopup()
        } else {
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
            closePopup()
            break
          case ' ':
            event.preventDefault()
            if (!isOpen) {
              openPopup()
            }
            break
        }
      },
      selectOptionClick(event: { target: HTMLElement }) {
        const option = event.target.closest('[role="option"]') as HTMLElement
        if (option) {
          const index = options.indexOf(option)
          if (index >= 0) {
            selectOption(index)
          }
        }
      },
      onConnected() {
        options = getOptions()

        // Add click handlers to options
        options.forEach((option, index) => {
          ;(option as HTMLElement).addEventListener('click', () => {
            selectOption(index)
          })
        })

        // Initialize from value attribute
        const value = host.getAttribute('value')
        if (value && input) {
          input.attr('value', value)
          const matchingIndex = options.findIndex((o) => o.textContent?.trim() === value)
          if (matchingIndex >= 0) {
            selectedIndex = matchingIndex
          }
        }
      },
    }
  },
})

// bElement for editable combobox - defined locally, NOT exported
const EditableCombobox = bElement({
  tag: 'pattern-editable-combobox',
  observedAttributes: ['value', 'options'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div p-target="wrapper" {...styles.combobox}>
      <input
        type="text"
        p-target="input"
        aria-label="Search"
        role="combobox"
        aria-expanded="false"
        aria-controls="listbox"
        aria-autocomplete="list"
        p-trigger={{ input: 'handleInput', keydown: 'handleInputKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
        {...styles.input}
      />
      <ul
        p-target="listbox"
        role="listbox"
        id="listbox"
        {...styles.listbox}
      >
        {/* Options rendered dynamically */}
      </ul>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const input = $<HTMLInputElement>('input')[0]
    const listbox = $('listbox')[0]

    let allOptions: string[] = []
    let filteredOptions: string[] = []
    let selectedIndex = -1
    let isOpen = false

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
            role="option"
            aria-selected={index === selectedIndex ? 'true' : 'false'}
            id={`option-${index}`}
            data-index={String(index)}
            p-trigger={{ click: 'selectOptionClick' }}
            {...styles.option}
            {...(index === selectedIndex ? styles.optionSelected : {})}
          >
            {option}
          </li>
        ))
      )
    }

    const openPopup = () => {
      if (isOpen || filteredOptions.length === 0) return
      isOpen = true
      input?.attr('aria-expanded', 'true')
      listbox?.attr('class', `${styles.listbox.classNames.join(' ')} ${styles.listboxOpen.classNames.join(' ')}`)
    }

    const closePopup = () => {
      if (!isOpen) return
      isOpen = false
      input?.attr('aria-expanded', 'false')
      listbox?.attr('class', styles.listbox.classNames.join(' '))
      input?.attr('aria-activedescendant', null)
      selectedIndex = -1
    }

    const updateActiveOption = () => {
      if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
        input?.attr('aria-activedescendant', `option-${selectedIndex}`)
        renderOptions()
      }
    }

    const selectOption = (index: number) => {
      if (index < 0 || index >= filteredOptions.length) return

      const value = filteredOptions[index]
      input?.attr('value', value)
      host.setAttribute('value', value)
      internals.setFormValue(value)

      closePopup()
      input?.root.focus()

      emit({ type: 'change', detail: { value, index } })
    }

    return {
      handleInput(event: Event) {
        const target = event.target as HTMLInputElement
        const query = target.value
        filterOptions(query)

        if (filteredOptions.length > 0 && query.length > 0) {
          openPopup()
          selectedIndex = 0
          updateActiveOption()
        } else {
          closePopup()
        }

        emit({ type: 'input', detail: { value: query } })
      },
      handleFocus() {
        filterOptions(input?.root.value || '')
        if (filteredOptions.length > 0) {
          openPopup()
        }
      },
      handleBlur() {
        // Delay to allow click on option
        setTimeout(() => closePopup(), 150)
      },
      handleInputKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            if (!isOpen && filteredOptions.length > 0) {
              openPopup()
              selectedIndex = 0
            } else if (isOpen) {
              selectedIndex = Math.min(selectedIndex + 1, filteredOptions.length - 1)
            }
            updateActiveOption()
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
      selectOptionClick(event: { target: HTMLElement }) {
        const index = parseInt(event.target.getAttribute('data-index') || '-1', 10)
        if (index >= 0) {
          selectOption(index)
        }
      },
      onConnected() {
        // Initialize options from attribute
        const optionsAttr = host.getAttribute('options')
        if (optionsAttr) {
          try {
            allOptions = JSON.parse(optionsAttr)
            filteredOptions = allOptions
          } catch {
            // Invalid JSON
          }
        }

        // Initialize value
        const value = host.getAttribute('value')
        if (value && input) {
          input.attr('value', value)
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'options' && newValue) {
          try {
            allOptions = JSON.parse(newValue)
            filteredOptions = allOptions
            renderOptions()
          } catch {
            // Invalid JSON
          }
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const selectOnlyCombobox = story({
  intent: 'Select-only combobox similar to native select element',
  template: () => (
    <SelectCombobox>
      <li role="option">Apple</li>
      <li role="option">Banana</li>
      <li role="option">Cherry</li>
      <li role="option">Date</li>
      <li role="option">Elderberry</li>
    </SelectCombobox>
  ),
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const input = await findByAttribute('p-target', 'input')

    assert({
      given: 'select combobox is rendered',
      should: 'have aria-expanded="false" initially',
      actual: input?.getAttribute('aria-expanded'),
      expected: 'false',
    })

    if (input) await fireEvent(input, 'click')

    assert({
      given: 'input is clicked',
      should: 'expand the listbox',
      actual: input?.getAttribute('aria-expanded'),
      expected: 'true',
    })
  },
})

export const editableCombobox = story({
  intent: 'Editable combobox with autocomplete filtering',
  template: () => (
    <EditableCombobox
      options={JSON.stringify(['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Cranberry'])}
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const input = await findByAttribute('p-target', 'input')

    assert({
      given: 'editable combobox is rendered',
      should: 'have aria-autocomplete="list"',
      actual: input?.getAttribute('aria-autocomplete'),
      expected: 'list',
    })
  },
})

export const preselectedCombobox = story({
  intent: 'Combobox with initial value pre-selected',
  template: () => (
    <SelectCombobox value="Cherry">
      <li role="option">Apple</li>
      <li role="option">Banana</li>
      <li role="option">Cherry</li>
    </SelectCombobox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const input = await findByAttribute('p-target', 'input')

    assert({
      given: 'combobox has value attribute',
      should: 'display the selected value',
      actual: input?.getAttribute('value'),
      expected: 'Cherry',
    })
  },
})

export const searchCombobox = story({
  intent: 'Search field with suggestions from previous searches',
  template: () => (
    <EditableCombobox
      aria-label="Search"
      options={JSON.stringify(['Recent: plaited documentation', 'Recent: bElement examples', 'Recent: CSS-in-JS'])}
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - comboboxes are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `render`, `attr`, `internals`
- **Requires external web API**: Focus management APIs
- **Cleanup required**: No

## Keyboard Interaction

### Combobox Input

- **Arrow Down**: Opens popup or moves to next option
- **Arrow Up**: Moves to previous option (if open)
- **Enter**: Accepts selected option
- **Escape**: Closes popup
- **Space**: Opens popup (select-only)
- **Printable characters**: Types in editable combobox

### Listbox Popup

- **Arrow Down/Up**: Moves selection
- **Enter**: Accepts option, closes popup
- **Escape**: Closes popup

## WAI-ARIA Roles, States, and Properties

### Required

- **role="combobox"**: On the input element
- **aria-expanded**: `"true"` when popup is open
- **aria-controls**: ID reference to popup element
- **aria-haspopup**: Popup type (default: `listbox`)
- **role="listbox"**: On popup container
- **role="option"**: On each option element

### Optional

- **aria-autocomplete**: `"none"`, `"list"`, or `"both"`
- **aria-activedescendant**: ID of active option
- **aria-selected**: `"true"` on selected option

## Best Practices

1. **Use bElements** - Comboboxes require complex state management
2. **Use `aria-activedescendant`** for popup navigation
3. **Handle all keyboard interactions** - Arrow keys, Enter, Escape
4. **Filter options dynamically** for editable comboboxes
5. **Use spread syntax** - `{...styles.x}` for applying styles
6. **Use `$()` with `p-target`** - never use `querySelector` directly
7. **Use `formAssociated: true`** for form integration

## Accessibility Considerations

- Screen readers announce combobox role, label, and expanded state
- Keyboard users can navigate options without mouse
- `aria-activedescendant` enables screen reader navigation in popup
- Selected options are clearly indicated

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- MDN: [ARIA combobox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/combobox_role)
- MDN: [aria-activedescendant](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-activedescendant)
