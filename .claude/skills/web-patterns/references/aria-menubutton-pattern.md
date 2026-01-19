# ARIA Menu Button Pattern

## Overview

A menu button is a button that opens a menu as described in the Menu and Menubar Pattern. It is often styled as a typical push button with a downward pointing arrow or triangle to hint that activating the button will display a menu.

**Key Characteristics:**
- **Button trigger**: Opens/closes a menu on activation
- **Menu coordination**: Manages menu visibility and focus
- **Keyboard support**: Enter, Space, optional Down/Up Arrow
- **Focus management**: Returns focus to button when menu closes
- **Visual indicator**: Often includes downward arrow/triangle icon
- **ARIA attributes**: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`

## Use Cases

- Dropdown action buttons ("Actions ▼")
- Navigation menu buttons
- Settings/preferences menus
- Filter/sort controls
- User account menus
- Language selector buttons
- Theme switcher buttons

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Menu button with menu -->
<button
  type="button"
  aria-haspopup="menu"
  aria-expanded="false"
  aria-controls="action-menu"
  aria-label="Actions"
>
  Actions
  <span aria-hidden="true">▼</span>
</button>
<ul role="menu" id="action-menu" aria-label="Actions" hidden>
  <li role="menuitem">Edit</li>
  <li role="menuitem">Delete</li>
  <li role="separator"></li>
  <li role="menuitem">Share</li>
</ul>
```

```javascript
const button = document.querySelector('button[aria-haspopup="menu"]')
const menu = document.querySelector('ul[role="menu"]')

button.addEventListener('click', () => {
  const isOpen = button.getAttribute('aria-expanded') === 'true'
  if (isOpen) {
    closeMenu()
  } else {
    openMenu()
  }
})

button.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (button.getAttribute('aria-expanded') === 'false') {
      openMenu()
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (button.getAttribute('aria-expanded') === 'false') {
      openMenu()
      // Focus first menu item
    }
  }
})

function openMenu() {
  button.setAttribute('aria-expanded', 'true')
  menu.removeAttribute('hidden')
  // Focus first menu item
}

function closeMenu() {
  button.setAttribute('aria-expanded', 'false')
  menu.setAttribute('hidden', '')
  button.focus()
}
```

### Plaited Adaptation

**File Structure:**

```
menu-button/
  menu-button.css.ts       # Styles (createStyles) - ALWAYS separate
  menu-button.stories.tsx  # FT/bElement + stories (imports from css.ts)
```

#### menu-button.css.ts

```typescript
// menu-button.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'inline-block',
  position: 'relative',
})

export const styles = createStyles({
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  button: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  buttonExpanded: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  icon: {
    fontSize: '0.75em',
    transition: 'transform 0.2s',
  },
  iconRotated: {
    transform: 'rotate(180deg)',
  },
  menu: {
    position: 'absolute',
    insetBlockStart: '100%',
    insetInlineStart: 0,
    marginBlockStart: '0.25rem',
    minInlineSize: '200px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    listStyle: 'none',
    padding: '0.25rem',
    margin: 0,
    zIndex: 1000,
  },
  menuHidden: {
    display: 'none',
  },
  menuitem: {
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  menuitemFocused: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  separator: {
    blockSize: '1px',
    backgroundColor: '#ccc',
    marginBlock: '0.25rem',
    border: 'none',
  },
})
```

#### menu-button.stories.tsx

```typescript
// menu-button.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './menu-button.css.ts'

// MenuItem FunctionalTemplate - defined locally, NOT exported
const MenuItem: FT<{
  value?: string
  children?: Children
}> = ({ value, children, ...attrs }) => (
  <li
    role="menuitem"
    data-value={value}
    tabIndex={-1}
    {...attrs}
    {...styles.menuitem}
  >
    {children}
  </li>
)

// MenuItemCheckbox FunctionalTemplate - defined locally, NOT exported
const MenuItemCheckbox: FT<{
  value?: string
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-checked': ariaChecked, children, ...attrs }) => (
  <li
    role="menuitemcheckbox"
    data-value={value}
    aria-checked={ariaChecked}
    tabIndex={-1}
    {...attrs}
    {...styles.menuitem}
  >
    {ariaChecked === 'true' ? '✓ ' : ''}{children}
  </li>
)

// MenuItemRadio FunctionalTemplate - defined locally, NOT exported
const MenuItemRadio: FT<{
  value?: string
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-checked': ariaChecked, children, ...attrs }) => (
  <li
    role="menuitemradio"
    data-value={value}
    aria-checked={ariaChecked}
    tabIndex={-1}
    {...attrs}
    {...styles.menuitem}
  >
    {ariaChecked === 'true' ? '● ' : '○ '}{children}
  </li>
)

// MenuSeparator FunctionalTemplate - defined locally, NOT exported
const MenuSeparator: FT = () => (
  <li role="separator" aria-orientation="horizontal" {...styles.separator}></li>
)

// MenuButton bElement - defined locally, NOT exported
const MenuButton = bElement({
  tag: 'pattern-menu-button',
  observedAttributes: ['open', 'aria-label'],
  hostStyles,
  shadowDom: (
    <div p-target="container" {...styles.container}>
      <button
        p-target="button"
        type="button"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls="menu"
        {...styles.button}
        p-trigger={{ click: 'toggleMenu', keydown: 'handleButtonKeydown' }}
      >
        <slot name="label">Menu</slot>
        <span aria-hidden="true" p-target="icon" {...styles.icon}>▼</span>
      </button>
      <ul
        p-target="menu"
        role="menu"
        id="menu"
        aria-label="Menu"
        {...styles.menu}
        {...styles.menuHidden}
        p-trigger={{ keydown: 'handleMenuKeydown' }}
      >
        <slot name="items"></slot>
      </ul>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const button = $<HTMLButtonElement>('button')[0]
    const menu = $('menu')[0]
    const icon = $('icon')[0]
    let isOpen = false
    let focusedIndex = -1
    let clickOutsideHandler: ((e: MouseEvent) => void) | undefined

    const getItems = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
      ) as HTMLElement[]
    }

    const openMenu = () => {
      if (isOpen) return

      isOpen = true
      button?.attr('aria-expanded', 'true')
      button?.attr('class', `${styles.button.classNames.join(' ')} ${styles.buttonExpanded.classNames.join(' ')}`)
      icon?.attr('class', `${styles.icon.classNames.join(' ')} ${styles.iconRotated.classNames.join(' ')}`)
      menu?.attr('class', styles.menu.classNames.join(' '))
      menu?.removeAttribute('hidden')

      const items = getItems()
      if (items.length > 0) {
        focusedIndex = 0
        updateFocusedItem(items)
      }

      menu?.focus()

      clickOutsideHandler = (event: MouseEvent) => {
        if (!root.contains(event.target as Node)) {
          closeMenu()
        }
      }
      setTimeout(() => {
        document.addEventListener('click', clickOutsideHandler!)
      }, 0)

      emit({ type: 'open', detail: { button: button! } })
    }

    const closeMenu = () => {
      if (!isOpen) return

      isOpen = false
      focusedIndex = -1
      button?.attr('aria-expanded', 'false')
      button?.attr('class', styles.button.classNames.join(' '))
      icon?.attr('class', styles.icon.classNames.join(' '))
      menu?.attr('class', `${styles.menu.classNames.join(' ')} ${styles.menuHidden.classNames.join(' ')}`)
      menu?.setAttribute('hidden', '')
      menu?.removeAttribute('aria-activedescendant')

      getItems().forEach(item => {
        item.removeAttribute('data-focused')
        item.setAttribute('class', styles.menuitem.classNames.join(' '))
      })

      if (clickOutsideHandler) {
        document.removeEventListener('click', clickOutsideHandler)
        clickOutsideHandler = undefined
      }

      button?.focus()

      emit({ type: 'close', detail: { button: button! } })
    }

    const updateFocusedItem = (items: HTMLElement[]) => {
      items.forEach((item, idx) => {
        if (idx === focusedIndex) {
          const id = item.id || `menu-item-${idx}`
          if (!item.id) item.id = id
          menu?.setAttribute('aria-activedescendant', id)
          item.setAttribute('data-focused', 'true')
          item.setAttribute('class', `${styles.menuitem.classNames.join(' ')} ${styles.menuitemFocused.classNames.join(' ')}`)
        } else {
          item.removeAttribute('data-focused')
          item.setAttribute('class', styles.menuitem.classNames.join(' '))
        }
      })
    }

    const handleMenuSelection = (item: HTMLElement) => {
      const value = item.getAttribute('data-value') || item.textContent || ''
      const role = item.getAttribute('role')

      if (role === 'menuitemcheckbox') {
        const checked = item.getAttribute('aria-checked') === 'true'
        item.setAttribute('aria-checked', checked ? 'false' : 'true')
      } else if (role === 'menuitemradio') {
        getItems().filter(i => i.getAttribute('role') === 'menuitemradio').forEach(radio => {
          radio.setAttribute('aria-checked', 'false')
        })
        item.setAttribute('aria-checked', 'true')
      } else {
        emit({ type: 'select', detail: { value, item } })
        closeMenu()
      }
    }

    return {
      toggleMenu() {
        if (isOpen) {
          closeMenu()
        } else {
          openMenu()
        }
      },

      handleButtonKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'Enter':
          case ' ':
            event.preventDefault()
            if (!isOpen) openMenu()
            break

          case 'ArrowDown':
            event.preventDefault()
            openMenu()
            break

          case 'ArrowUp':
            event.preventDefault()
            openMenu()
            const items = getItems()
            if (items.length > 0) {
              focusedIndex = items.length - 1
              updateFocusedItem(items)
            }
            break
        }
      },

      handleMenuKeydown(event: KeyboardEvent) {
        if (!isOpen) return

        const items = getItems()
        if (items.length === 0) return

        switch (event.key) {
          case 'Escape':
            event.preventDefault()
            closeMenu()
            break

          case 'ArrowDown':
            event.preventDefault()
            focusedIndex = (focusedIndex + 1) % items.length
            updateFocusedItem(items)
            items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
            break

          case 'ArrowUp':
            event.preventDefault()
            focusedIndex = focusedIndex <= 0 ? items.length - 1 : focusedIndex - 1
            updateFocusedItem(items)
            items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
            break

          case 'Enter':
          case ' ':
            event.preventDefault()
            if (focusedIndex >= 0 && focusedIndex < items.length) {
              handleMenuSelection(items[focusedIndex])
            }
            break

          case 'Home':
            event.preventDefault()
            focusedIndex = 0
            updateFocusedItem(items)
            break

          case 'End':
            event.preventDefault()
            focusedIndex = items.length - 1
            updateFocusedItem(items)
            break
        }
      },

      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          button?.setAttribute('aria-label', ariaLabel)
          menu?.setAttribute('aria-label', ariaLabel)
        }
      },

      onDisconnected() {
        if (clickOutsideHandler) {
          document.removeEventListener('click', clickOutsideHandler)
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'open') {
          if (newValue !== null && !isOpen) {
            openMenu()
          } else if (newValue === null && isOpen) {
            closeMenu()
          }
        } else if (name === 'aria-label') {
          button?.setAttribute('aria-label', newValue || 'Menu')
          menu?.setAttribute('aria-label', newValue || 'Menu')
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const actionMenuButton = story({
  intent: 'Display a menu button with action items',
  template: () => (
    <MenuButton aria-label="Actions">
      <span slot="label">Actions</span>
      <MenuItem slot="items" value="edit">Edit</MenuItem>
      <MenuItem slot="items" value="delete">Delete</MenuItem>
      <MenuSeparator />
      <MenuItem slot="items" value="share">Share</MenuItem>
    </MenuButton>
  ),
  play: async ({ findByAttribute, assert }) => {
    const button = await findByAttribute('aria-haspopup', 'menu')

    assert({
      given: 'menu button is rendered',
      should: 'have aria-haspopup menu',
      actual: button?.getAttribute('aria-haspopup'),
      expected: 'menu',
    })
  },
})

export const menuButtonWithCheckboxes = story({
  intent: 'Display a menu button with checkbox items for toggle options',
  template: () => (
    <MenuButton aria-label="View options">
      <span slot="label">View</span>
      <MenuItemCheckbox slot="items" value="grid" aria-checked="true">Show grid</MenuItemCheckbox>
      <MenuItemCheckbox slot="items" value="rulers" aria-checked="false">Show rulers</MenuItemCheckbox>
    </MenuButton>
  ),
  play: async ({ findByAttribute, assert }) => {
    const checkbox = await findByAttribute('role', 'menuitemcheckbox')

    assert({
      given: 'menu has checkbox items',
      should: 'have menuitemcheckbox role',
      actual: checkbox?.getAttribute('role'),
      expected: 'menuitemcheckbox',
    })
  },
})

export const menuButtonWithRadio = story({
  intent: 'Display a menu button with radio items for exclusive selection',
  template: () => (
    <MenuButton aria-label="Alignment">
      <span slot="label">Align</span>
      <MenuItemRadio slot="items" value="left" aria-checked="true">Left</MenuItemRadio>
      <MenuItemRadio slot="items" value="center" aria-checked="false">Center</MenuItemRadio>
      <MenuItemRadio slot="items" value="right" aria-checked="false">Right</MenuItemRadio>
    </MenuButton>
  ),
  play: async ({ findByAttribute, assert }) => {
    const radio = await findByAttribute('role', 'menuitemradio')

    assert({
      given: 'menu has radio items',
      should: 'have menuitemradio role',
      actual: radio?.getAttribute('role'),
      expected: 'menuitemradio',
    })
  },
})

export const accessibilityTest = story({
  intent: 'Verify menu button accessibility requirements',
  template: () => (
    <MenuButton aria-label="Test menu">
      <span slot="label">Test</span>
      <MenuItem slot="items" value="item1">Item 1</MenuItem>
      <MenuItem slot="items" value="item2">Item 2</MenuItem>
    </MenuButton>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - menu button uses Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: No
- **Cleanup required**: Yes - click outside listener cleanup in `onDisconnected`

## Keyboard Interaction

### Button (when menu is closed)

- **Enter**: Opens menu and places focus on first menu item
- **Space**: Opens menu and places focus on first menu item
- **ArrowDown** (Optional): Opens menu and places focus on first menu item
- **ArrowUp** (Optional): Opens menu and places focus on last menu item

### Menu (when menu is open)

- **ArrowDown**: Moves focus to next item (wraps)
- **ArrowUp**: Moves focus to previous item (wraps)
- **Enter/Space**: Activates focused item (closes menu for regular items, toggles for checkboxes/radios)
- **Home**: Moves focus to first item
- **End**: Moves focus to last item
- **Escape**: Closes menu and returns focus to button

## WAI-ARIA Roles, States, and Properties

### Required

- **role="button"**: The element that opens the menu
- **aria-haspopup**: Set to `menu` or `true` on button
- **aria-expanded**: `true` when menu is open, `false` when closed
- **role="menu"**: Container for menu items

### Optional

- **aria-controls**: ID reference to menu element (on button)
- **aria-label** or **aria-labelledby**: Accessible name for button and menu
- **aria-activedescendant**: ID of focused menu item (for virtual focus)
- **role="menuitem"**: Regular menu item
- **role="menuitemcheckbox"**: Checkbox menu item
- **role="menuitemradio"**: Radio menu item
- **aria-checked**: `true`/`false` for checkbox/radio items
- **role="separator"**: Visual divider between item groups

## Best Practices

1. **Use bElement** - Menu buttons require state management and keyboard handling
2. **Use FunctionalTemplates** - for static menu item rendering
3. **Visual indicator** - Include downward arrow/triangle icon
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Focus management** - Return focus to button when menu closes
6. **Click outside** - Close menu when clicking outside
7. **Keyboard shortcuts** - Support Enter, Space, optional Arrow keys
8. **Menu positioning** - Position menu relative to button
9. **Virtual focus** - Use `aria-activedescendant` for menu navigation
10. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce button state and menu structure
- Keyboard users can open and navigate menu without mouse
- Focus indicators must be visible
- Menu must be properly positioned and announced
- Focus returns to button when menu closes
- Checkbox/radio states must be clearly indicated
- Menu items must be keyboard accessible

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- Related: [Menu and Menubar Pattern](./aria-menubar-pattern.md) - Menu implementation details
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
- MDN: [ARIA menu role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role)
