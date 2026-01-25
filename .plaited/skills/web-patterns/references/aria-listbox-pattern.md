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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

**File Structure:**

```
listbox/
  listbox.css.ts       # Styles (createStyles) - ALWAYS separate
  listbox.stories.tsx  # FT/bElement + stories (imports from css.ts)
```

#### listbox.css.ts

```typescript
// listbox.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  listbox: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    maxBlockSize: '200px',
    overflowY: 'auto',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    outline: 'none',
  },
  option: {
    padding: '0.5rem 1rem',
    cursor: 'pointer',
  },
  optionFocused: {
    backgroundColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#007bff',
    color: 'white',
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
```

#### listbox.stories.tsx

```typescript
// listbox.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './listbox.css.ts'

// Option FunctionalTemplate - defined locally, NOT exported
const Option: FT<{
  value?: string
  'aria-selected'?: 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-selected': ariaSelected = 'false', children, ...attrs }) => (
  <li
    role="option"
    data-value={value}
    aria-selected={ariaSelected}
    tabIndex={-1}
    {...attrs}
    {...styles.option}
    {...(ariaSelected === 'true' ? styles.optionSelected : {})}
  >
    {children}
  </li>
)

// OptionGroup FunctionalTemplate - defined locally, NOT exported
const OptionGroup: FT<{
  'aria-label': string
  children?: Children
}> = ({ 'aria-label': ariaLabel, children, ...attrs }) => (
  <li role="group" aria-label={ariaLabel} {...attrs} {...styles.group}>
    <div {...styles.groupLabel}>{ariaLabel}</div>
    <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
      {children}
    </ul>
  </li>
)

// Listbox bElement - defined locally, NOT exported
const Listbox = bElement({
  tag: 'pattern-listbox',
  observedAttributes: ['value', 'aria-multiselectable', 'aria-label'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <ul
      p-target="listbox"
      role="listbox"
      tabIndex={0}
      {...styles.listbox}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <slot></slot>
    </ul>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const listbox = $('listbox')[0]
    let options: HTMLElement[] = []
    let selectedIndex = -1
    let focusedIndex = -1
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined
    const isMultiSelect = () => host.getAttribute('aria-multiselectable') === 'true'

    const getOptions = (): HTMLElement[] => {
      return Array.from(root.querySelectorAll('[role="option"]')) as HTMLElement[]
    }

    const updateActiveDescendant = () => {
      // Remove focus from all options
      options.forEach((opt, idx) => {
        opt.removeAttribute('data-focused')
        const baseClasses = styles.option.classNames.join(' ')
        const isSelected = opt.getAttribute('aria-selected') === 'true'
        opt.setAttribute('class', isSelected
          ? `${baseClasses} ${styles.optionSelected.classNames.join(' ')}`
          : baseClasses
        )
      })

      if (focusedIndex >= 0 && focusedIndex < options.length) {
        const focusedOption = options[focusedIndex]
        const id = focusedOption.id || `option-${focusedIndex}`
        if (!focusedOption.id) focusedOption.id = id
        listbox?.attr('aria-activedescendant', id)
        focusedOption.setAttribute('data-focused', 'true')

        const baseClasses = styles.option.classNames.join(' ')
        const isSelected = focusedOption.getAttribute('aria-selected') === 'true'
        focusedOption.setAttribute('class', isSelected
          ? `${baseClasses} ${styles.optionSelected.classNames.join(' ')}`
          : `${baseClasses} ${styles.optionFocused.classNames.join(' ')}`
        )
      } else {
        listbox?.attr('aria-activedescendant', null)
      }
    }

    const selectOption = (index: number, toggle = false) => {
      if (index < 0 || index >= options.length) return

      const option = options[index]
      const value = option.getAttribute('data-value') || option.textContent || ''

      if (isMultiSelect()) {
        if (toggle) {
          const currentlySelected = option.getAttribute('aria-selected') === 'true'
          option.setAttribute('aria-selected', currentlySelected ? 'false' : 'true')
        } else {
          option.setAttribute('aria-selected', 'true')
        }
      } else {
        options.forEach(opt => opt.setAttribute('aria-selected', 'false'))
        option.setAttribute('aria-selected', 'true')
        selectedIndex = index
      }

      updateActiveDescendant()
      updateFormValue()
      emit({ type: 'select', detail: { value, index, option } })
    }

    const updateFormValue = () => {
      const selectedOptions = options.filter(opt => opt.getAttribute('aria-selected') === 'true')
      const values = selectedOptions.map(opt => opt.getAttribute('data-value') || opt.textContent || '')

      if (isMultiSelect()) {
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
      options[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }

    const handleTypeAhead = (char: string) => {
      typeAheadBuffer += char.toLowerCase()
      if (typeAheadTimeout) clearTimeout(typeAheadTimeout)

      const startIndex = (focusedIndex + 1) % options.length
      let foundIndex = -1

      for (let i = startIndex; i < options.length; i++) {
        const text = (options[i].textContent || '').toLowerCase()
        if (text.startsWith(typeAheadBuffer)) {
          foundIndex = i
          break
        }
      }

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
            if (!isMultiSelect()) selectOption(focusedIndex, false)
            break

          case 'ArrowUp':
            event.preventDefault()
            moveFocus('prev')
            if (!isMultiSelect()) selectOption(focusedIndex, false)
            break

          case 'Home':
            event.preventDefault()
            moveFocus('first')
            if (!isMultiSelect()) selectOption(focusedIndex, false)
            break

          case 'End':
            event.preventDefault()
            moveFocus('last')
            if (!isMultiSelect()) selectOption(focusedIndex, false)
            break

          case ' ':
            if (isMultiSelect()) {
              event.preventDefault()
              selectOption(focusedIndex, true)
            }
            break

          case 'Enter':
            event.preventDefault()
            selectOption(focusedIndex, isMultiSelect())
            break

          default:
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

        if (selectedIndex < 0) {
          focusedIndex = 0
        } else {
          focusedIndex = selectedIndex
        }
        updateActiveDescendant()
      },

      handleBlur() {
        if (typeAheadTimeout) {
          clearTimeout(typeAheadTimeout)
          typeAheadTimeout = undefined
        }
        typeAheadBuffer = ''
      },

      onConnected() {
        options = getOptions()

        const value = host.getAttribute('value')
        if (value) {
          if (isMultiSelect()) {
            try {
              const values = JSON.parse(value)
              options.forEach((opt, idx) => {
                const optValue = opt.getAttribute('data-value') || opt.textContent || ''
                if (values.includes(optValue)) {
                  opt.setAttribute('aria-selected', 'true')
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
                opt.setAttribute('aria-selected', 'true')
                selectedIndex = idx
              }
            })
          }
        }

        if (isMultiSelect()) {
          listbox?.attr('aria-multiselectable', 'true')
        }

        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          listbox?.attr('aria-label', ariaLabel)
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

// Stories - EXPORTED for testing/training
export const singleSelectListbox = story({
  intent: 'Display a single-select listbox for choosing one option',
  template: () => (
    <Listbox aria-label="Choose a country">
      <Option value="us">United States</Option>
      <Option value="ca">Canada</Option>
      <Option value="mx">Mexico</Option>
    </Listbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const listbox = await findByAttribute('role', 'listbox')

    assert({
      given: 'listbox is rendered',
      should: 'have listbox role',
      actual: listbox?.getAttribute('role'),
      expected: 'listbox',
    })
  },
})

export const multiSelectListbox = story({
  intent: 'Display a multi-select listbox allowing multiple selections',
  template: () => (
    <Listbox aria-multiselectable="true" aria-label="Choose countries">
      <Option value="us">United States</Option>
      <Option value="ca" aria-selected="true">Canada</Option>
      <Option value="mx" aria-selected="true">Mexico</Option>
    </Listbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const listbox = await findByAttribute('role', 'listbox')

    assert({
      given: 'multi-select listbox is rendered',
      should: 'have aria-multiselectable true',
      actual: listbox?.getAttribute('aria-multiselectable'),
      expected: 'true',
    })
  },
})

export const groupedListbox = story({
  intent: 'Display a listbox with grouped options',
  template: () => (
    <Listbox aria-label="Choose a city">
      <OptionGroup aria-label="North America">
        <Option value="ny">New York</Option>
        <Option value="toronto">Toronto</Option>
      </OptionGroup>
      <OptionGroup aria-label="Europe">
        <Option value="london">London</Option>
        <Option value="paris">Paris</Option>
      </OptionGroup>
    </Listbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const group = await findByAttribute('role', 'group')

    assert({
      given: 'grouped listbox is rendered',
      should: 'have group role',
      actual: group?.getAttribute('role'),
      expected: 'group',
    })
  },
})

export const preselectedListbox = story({
  intent: 'Display a listbox with a pre-selected option',
  template: () => (
    <Listbox aria-label="Choose a color" value="green">
      <Option value="red">Red</Option>
      <Option value="green" aria-selected="true">Green</Option>
      <Option value="blue">Blue</Option>
    </Listbox>
  ),
  play: async ({ findByAttribute, assert }) => {
    const selectedOption = await findByAttribute('aria-selected', 'true')

    assert({
      given: 'listbox has pre-selected option',
      should: 'have selected option',
      actual: selectedOption?.getAttribute('data-value'),
      expected: 'green',
    })
  },
})

export const accessibilityTest = story({
  intent: 'Verify listbox accessibility requirements',
  template: () => (
    <Listbox aria-label="Test listbox">
      <Option value="opt1">Option 1</Option>
      <Option value="opt2">Option 2</Option>
      <Option value="opt3">Option 3</Option>
    </Listbox>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - listbox uses Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No
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
2. **Use FunctionalTemplates** - for static option rendering
3. **Virtual focus** - Use `aria-activedescendant` instead of moving DOM focus
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Type-ahead** - Implement for lists with more than 7 options
6. **Short option names** - Avoid very long option text
7. **Unique prefixes** - Avoid options starting with same word/phrase
8. **Scroll into view** - Ensure focused options are visible
9. **Form association** - Use `formAssociated: true` for form integration
10. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce option names, states, and positions
- Keyboard users can navigate without mouse
- Focus indicators must be visible
- Selected state must be clearly indicated
- Type-ahead improves efficiency for long lists
- Grouped options help organize related choices
- Virtual focus (`aria-activedescendant`) keeps DOM focus on listbox container

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
- MDN: [ARIA listbox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/listbox_role)
- MDN: [ARIA option role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/option_role)
- MDN: [Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant)
- Related: [Combobox Pattern](./aria-combobox-pattern.md) - Uses listbox as popup
