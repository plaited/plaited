# ARIA Menu and Menubar Pattern

## Overview

A menu is a widget that offers a list of choices to the user, such as a set of actions or functions. Menu widgets behave like native operating system menus, such as the menus that pull down from the menubars commonly found at the top of many desktop application windows. A menu is usually opened, or made visible, by activating a menu button, choosing an item in a menu that opens a submenu, or by invoking a command.

A menu that is visually persistent is a menubar. A menubar is typically horizontal and is often used to create a menu bar similar to those found near the top of the window in many desktop applications, offering the user quick access to a consistent set of commands.

**Key Characteristics:**
- **Menubar**: Visually persistent, typically horizontal menu
- **Menu**: Popup menu that appears on demand
- **Menu items**: `menuitem`, `menuitemcheckbox`, `menuitemradio`
- **Submenus**: Nested menus from parent menu items
- **Keyboard navigation**: Complex arrow key navigation, Tab, Enter, Space, Escape
- **Focus management**: Uses `aria-activedescendant` for virtual focus
- **Separators**: Visual dividers between menu item groups

**Common Convention**: Menu items that launch dialogs are indicated with "…" (ellipsis), e.g., "Save as …".

## Use Cases

- Application menubars (File, Edit, View, etc.)
- Context menus (right-click menus)
- Navigation menubars
- Settings/preferences menus
- Action menus (dropdown actions)
- Editor formatting menus
- Command palettes

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Menubar -->
<nav role="menubar" aria-label="Main navigation">
  <button role="menuitem" aria-haspopup="true" aria-expanded="false">
    File
  </button>
  <ul role="menu" aria-label="File">
    <li role="menuitem">New</li>
    <li role="menuitem">Open</li>
    <li role="separator" aria-orientation="horizontal"></li>
    <li role="menuitem">Exit</li>
  </ul>
</nav>

<!-- Menu with checkboxes -->
<ul role="menu" aria-label="View options">
  <li role="menuitemcheckbox" aria-checked="true">Show grid</li>
  <li role="menuitemcheckbox" aria-checked="false">Show rulers</li>
</ul>

<!-- Menu with radio items -->
<ul role="menu" aria-label="Alignment">
  <li role="menuitemradio" aria-checked="true">Left</li>
  <li role="menuitemradio" aria-checked="false">Center</li>
  <li role="menuitemradio" aria-checked="false">Right</li>
</ul>
```

```javascript
// Keyboard navigation
menubar.addEventListener('keydown', (e) => {
  const items = Array.from(menubar.querySelectorAll('[role="menuitem"]'))
  const currentIndex = items.findIndex(item => item === document.activeElement)

  switch(e.key) {
    case 'ArrowRight':
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % items.length
      items[nextIndex].focus()
      break
    case 'ArrowLeft':
      e.preventDefault()
      const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
      items[prevIndex].focus()
      break
    case 'ArrowDown':
      e.preventDefault()
      // Open submenu if exists
      if (items[currentIndex].getAttribute('aria-haspopup') === 'true') {
        openSubmenu(items[currentIndex])
      }
      break
  }
})
```

### Plaited Adaptation

**File Structure:**

```
menu/
  menu.css.ts        # Styles (createStyles) - ALWAYS separate
  menu.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### menu.css.ts

```typescript
// menu.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  menubar: {
    display: 'flex',
    gap: '0.25rem',
    padding: '0.5rem',
    backgroundColor: '#f0f0f0',
    borderBlockEnd: '1px solid #ccc',
  },
  menu: {
    position: 'absolute',
    insetBlockStart: '100%',
    insetInlineStart: 0,
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
  menuVisible: {
    display: 'block',
  },
  menuitem: {
    padding: '0.5rem 1rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'block',
    inlineSize: '100%',
    textAlign: 'start',
  },
  menuitemFocused: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  menuitemExpanded: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  separator: {
    blockSize: '1px',
    backgroundColor: '#ccc',
    marginBlock: '0.25rem',
    border: 'none',
  },
  submenuItem: {
    position: 'relative',
  },
})
```

#### menu.stories.tsx

```typescript
// menu.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './menu.css.ts'

// MenuItem FunctionalTemplate - defined locally, NOT exported
const MenuItem: FT<{
  'aria-haspopup'?: 'true' | 'false' | 'menu'
  'aria-expanded'?: 'true' | 'false'
  children?: Children
}> = ({ 'aria-haspopup': ariaHasPopup, 'aria-expanded': ariaExpanded, children, ...attrs }) => (
  <button
    role="menuitem"
    aria-haspopup={ariaHasPopup}
    aria-expanded={ariaExpanded}
    tabIndex={-1}
    {...attrs}
    {...styles.menuitem}
  >
    {children}
  </button>
)

// MenuItemCheckbox FunctionalTemplate - defined locally, NOT exported
const MenuItemCheckbox: FT<{
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ 'aria-checked': ariaChecked, children, ...attrs }) => (
  <div
    role="menuitemcheckbox"
    aria-checked={ariaChecked}
    tabIndex={-1}
    {...attrs}
    {...styles.menuitem}
  >
    {ariaChecked === 'true' ? '✓ ' : ''}{children}
  </div>
)

// MenuItemRadio FunctionalTemplate - defined locally, NOT exported
const MenuItemRadio: FT<{
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ 'aria-checked': ariaChecked, children, ...attrs }) => (
  <div
    role="menuitemradio"
    aria-checked={ariaChecked}
    tabIndex={-1}
    {...attrs}
    {...styles.menuitem}
  >
    {ariaChecked === 'true' ? '● ' : '○ '}{children}
  </div>
)

// MenuSeparator FunctionalTemplate - defined locally, NOT exported
const MenuSeparator: FT = () => (
  <li role="separator" aria-orientation="horizontal" {...styles.separator}></li>
)

// Menubar bElement - defined locally, NOT exported
const Menubar = bElement({
  tag: 'pattern-menubar',
  observedAttributes: ['aria-label', 'aria-orientation'],
  hostStyles,
  shadowDom: (
    <nav
      p-target="menubar"
      role="menubar"
      tabIndex={0}
      {...styles.menubar}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <slot></slot>
    </nav>
  ),
  bProgram({ $, host, emit, root }) {
    const menubar = $('menubar')[0]
    let items: HTMLElement[] = []
    let focusedIndex = -1
    let openSubmenuIndex = -1
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined
    const isVertical = () => host.getAttribute('aria-orientation') === 'vertical'

    const getItems = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
      ) as HTMLElement[]
    }

    const getSubmenu = (item: HTMLElement): HTMLElement | null => {
      let next = item.nextElementSibling
      while (next) {
        if (next.getAttribute('role') === 'menu') {
          return next as HTMLElement
        }
        next = next.nextElementSibling
      }
      return null
    }

    const closeAllSubmenus = () => {
      items.forEach(item => {
        const submenu = getSubmenu(item)
        if (submenu) {
          item.setAttribute('aria-expanded', 'false')
          item.setAttribute('class', styles.menuitem.classNames.join(' '))
          submenu.setAttribute('class', `${styles.menu.classNames.join(' ')} ${styles.menuHidden.classNames.join(' ')}`)
          submenu.setAttribute('hidden', '')
        }
      })
      openSubmenuIndex = -1
    }

    const openSubmenu = (index: number) => {
      if (index < 0 || index >= items.length) return

      const item = items[index]
      const submenu = getSubmenu(item)
      if (!submenu) return

      closeAllSubmenus()

      item.setAttribute('aria-expanded', 'true')
      item.setAttribute('class', `${styles.menuitem.classNames.join(' ')} ${styles.menuitemExpanded.classNames.join(' ')}`)
      submenu.setAttribute('class', `${styles.menu.classNames.join(' ')} ${styles.menuVisible.classNames.join(' ')}`)
      submenu.removeAttribute('hidden')
      openSubmenuIndex = index

      const submenuItems = Array.from(submenu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')) as HTMLElement[]
      if (submenuItems.length > 0) {
        const firstItem = submenuItems[0]
        const id = firstItem.id || `submenu-item-${index}-0`
        if (!firstItem.id) firstItem.id = id
        submenu.setAttribute('aria-activedescendant', id)
        firstItem.setAttribute('data-focused', 'true')
      }
    }

    const updateActiveDescendant = () => {
      items.forEach((item, idx) => {
        item.removeAttribute('data-focused')
        if (idx !== focusedIndex) {
          item.setAttribute('class', styles.menuitem.classNames.join(' '))
        }
      })

      if (focusedIndex >= 0 && focusedIndex < items.length) {
        const focusedItem = items[focusedIndex]
        const id = focusedItem.id || `menuitem-${focusedIndex}`
        if (!focusedItem.id) focusedItem.id = id
        menubar?.attr('aria-activedescendant', id)
        focusedItem.setAttribute('data-focused', 'true')
        focusedItem.setAttribute('class', `${styles.menuitem.classNames.join(' ')} ${styles.menuitemFocused.classNames.join(' ')}`)
      } else {
        menubar?.attr('aria-activedescendant', null)
      }
    }

    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      if (items.length === 0) return

      let newIndex = focusedIndex
      switch (direction) {
        case 'next':
          newIndex = (focusedIndex + 1) % items.length
          break
        case 'prev':
          newIndex = focusedIndex <= 0 ? items.length - 1 : focusedIndex - 1
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = items.length - 1
          break
      }

      focusedIndex = newIndex
      updateActiveDescendant()
    }

    const activateItem = (index: number) => {
      if (index < 0 || index >= items.length) return

      const item = items[index]
      const role = item.getAttribute('role')
      const hasSubmenu = item.getAttribute('aria-haspopup') === 'true' || item.getAttribute('aria-haspopup') === 'menu'

      if (hasSubmenu) {
        openSubmenu(index)
      } else {
        if (role === 'menuitemcheckbox') {
          const checked = item.getAttribute('aria-checked') === 'true'
          item.setAttribute('aria-checked', checked ? 'false' : 'true')
        } else if (role === 'menuitemradio') {
          const group = item.closest('[role="menu"]')
          if (group) {
            Array.from(group.querySelectorAll('[role="menuitemradio"]')).forEach(radio => {
              radio.setAttribute('aria-checked', 'false')
            })
          }
          item.setAttribute('aria-checked', 'true')
        }

        const value = item.getAttribute('data-value') || item.textContent || ''
        emit({ type: 'activate', detail: { value, item } })
        emit({ type: 'select', detail: { value, item } })
        closeAllSubmenus()
      }
    }

    const handleTypeAhead = (char: string) => {
      typeAheadBuffer += char.toLowerCase()
      if (typeAheadTimeout) clearTimeout(typeAheadTimeout)

      const startIndex = (focusedIndex + 1) % items.length
      let foundIndex = -1

      for (let i = startIndex; i < items.length; i++) {
        const text = (items[i].textContent || '').toLowerCase()
        if (text.startsWith(typeAheadBuffer)) {
          foundIndex = i
          break
        }
      }

      if (foundIndex === -1) {
        for (let i = 0; i < startIndex; i++) {
          const text = (items[i].textContent || '').toLowerCase()
          if (text.startsWith(typeAheadBuffer)) {
            foundIndex = i
            break
          }
        }
      }

      if (foundIndex >= 0) {
        focusedIndex = foundIndex
        updateActiveDescendant()
      }

      typeAheadTimeout = setTimeout(() => {
        typeAheadBuffer = ''
      }, 1000)
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        if (items.length === 0) return

        switch (event.key) {
          case isVertical() ? 'ArrowDown' : 'ArrowRight':
            event.preventDefault()
            moveFocus('next')
            break

          case isVertical() ? 'ArrowUp' : 'ArrowLeft':
            event.preventDefault()
            moveFocus('prev')
            break

          case isVertical() ? 'ArrowRight' : 'ArrowDown':
            event.preventDefault()
            if (focusedIndex >= 0) {
              const item = items[focusedIndex]
              const hasSubmenu = item.getAttribute('aria-haspopup') === 'true' || item.getAttribute('aria-haspopup') === 'menu'
              if (hasSubmenu) {
                openSubmenu(focusedIndex)
              }
            }
            break

          case 'Enter':
          case ' ':
            event.preventDefault()
            if (focusedIndex >= 0) {
              activateItem(focusedIndex)
            }
            break

          case 'Home':
            event.preventDefault()
            moveFocus('first')
            break

          case 'End':
            event.preventDefault()
            moveFocus('last')
            break

          case 'Escape':
            event.preventDefault()
            closeAllSubmenus()
            break

          case 'Tab':
            closeAllSubmenus()
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
        items = getItems()
        if (items.length === 0) return

        if (focusedIndex < 0) {
          focusedIndex = 0
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
        items = getItems()

        items.forEach((item, index) => {
          if (index === 0) {
            item.setAttribute('tabindex', '0')
          } else {
            item.setAttribute('tabindex', '-1')
          }
        })

        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          menubar?.attr('aria-label', ariaLabel)
        }

        if (isVertical()) {
          menubar?.attr('aria-orientation', 'vertical')
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

// Menu (Popup) bElement - defined locally, NOT exported
const Menu = bElement({
  tag: 'pattern-menu',
  observedAttributes: ['open', 'aria-label'],
  hostStyles,
  shadowDom: (
    <ul
      p-target="menu"
      role="menu"
      tabIndex={-1}
      {...styles.menu}
      {...styles.menuHidden}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus' }}
    >
      <slot></slot>
    </ul>
  ),
  bProgram({ $, host, emit }) {
    const menu = $('menu')[0]
    let items: HTMLElement[] = []
    let focusedIndex = -1
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined

    const getItems = (): HTMLElement[] => {
      return Array.from(
        menu?.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]') || []
      ) as HTMLElement[]
    }

    const updateActiveDescendant = () => {
      items.forEach((item, idx) => {
        item.removeAttribute('data-focused')
        if (idx !== focusedIndex) {
          item.setAttribute('class', styles.menuitem.classNames.join(' '))
        }
      })

      if (focusedIndex >= 0 && focusedIndex < items.length) {
        const focusedItem = items[focusedIndex]
        const id = focusedItem.id || `menuitem-${focusedIndex}`
        if (!focusedItem.id) focusedItem.id = id
        menu?.attr('aria-activedescendant', id)
        focusedItem.setAttribute('data-focused', 'true')
        focusedItem.setAttribute('class', `${styles.menuitem.classNames.join(' ')} ${styles.menuitemFocused.classNames.join(' ')}`)
      } else {
        menu?.attr('aria-activedescendant', null)
      }
    }

    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last') => {
      if (items.length === 0) return

      let newIndex = focusedIndex
      switch (direction) {
        case 'next':
          newIndex = (focusedIndex + 1) % items.length
          break
        case 'prev':
          newIndex = focusedIndex <= 0 ? items.length - 1 : focusedIndex - 1
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = items.length - 1
          break
      }

      focusedIndex = newIndex
      updateActiveDescendant()
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }

    const activateItem = (index: number) => {
      if (index < 0 || index >= items.length) return

      const item = items[index]
      const role = item.getAttribute('role')

      if (role === 'menuitemcheckbox') {
        const checked = item.getAttribute('aria-checked') === 'true'
        item.setAttribute('aria-checked', checked ? 'false' : 'true')
      } else if (role === 'menuitemradio') {
        items.filter(i => i.getAttribute('role') === 'menuitemradio').forEach(radio => {
          radio.setAttribute('aria-checked', 'false')
        })
        item.setAttribute('aria-checked', 'true')
      }

      const value = item.getAttribute('data-value') || item.textContent || ''
      emit({ type: 'activate', detail: { value, item } })
      emit({ type: 'select', detail: { value, item } })
      closeMenu()
    }

    const openMenu = () => {
      menu?.setAttribute('class', `${styles.menu.classNames.join(' ')} ${styles.menuVisible.classNames.join(' ')}`)
      menu?.removeAttribute('hidden')
      items = getItems()
      if (items.length > 0) {
        focusedIndex = 0
        updateActiveDescendant()
      }
    }

    const closeMenu = () => {
      menu?.setAttribute('class', `${styles.menu.classNames.join(' ')} ${styles.menuHidden.classNames.join(' ')}`)
      menu?.setAttribute('hidden', '')
      menu?.attr('aria-activedescendant', null)
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        if (items.length === 0) return

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            moveFocus('next')
            break

          case 'ArrowUp':
            event.preventDefault()
            moveFocus('prev')
            break

          case 'Enter':
          case ' ':
            event.preventDefault()
            if (focusedIndex >= 0) {
              activateItem(focusedIndex)
            }
            break

          case 'Home':
            event.preventDefault()
            moveFocus('first')
            break

          case 'End':
            event.preventDefault()
            moveFocus('last')
            break

          case 'Escape':
            event.preventDefault()
            closeMenu()
            break
        }
      },

      handleFocus() {
        items = getItems()
        if (items.length > 0 && focusedIndex < 0) {
          focusedIndex = 0
          updateActiveDescendant()
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'open') {
          if (newValue !== null) {
            openMenu()
          } else {
            closeMenu()
          }
        } else if (name === 'aria-label') {
          menu?.attr('aria-label', newValue || null)
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
export const simpleMenubar = story({
  intent: 'Display a simple horizontal menubar with menu items',
  template: () => (
    <Menubar aria-label="File actions">
      <MenuItem>New</MenuItem>
      <MenuItem>Open</MenuItem>
      <MenuItem>Save</MenuItem>
    </Menubar>
  ),
  play: async ({ findByAttribute, assert }) => {
    const menubar = await findByAttribute('role', 'menubar')

    assert({
      given: 'menubar is rendered',
      should: 'have menubar role',
      actual: menubar?.getAttribute('role'),
      expected: 'menubar',
    })
  },
})

export const menuWithSeparator = story({
  intent: 'Display a menu with separator between item groups',
  template: () => (
    <Menu open aria-label="File menu">
      <MenuItem>New</MenuItem>
      <MenuItem>Open</MenuItem>
      <MenuSeparator />
      <MenuItem>Exit</MenuItem>
    </Menu>
  ),
  play: async ({ findByAttribute, assert }) => {
    const separator = await findByAttribute('role', 'separator')

    assert({
      given: 'menu has separator',
      should: 'have separator role',
      actual: separator?.getAttribute('role'),
      expected: 'separator',
    })
  },
})

export const menuWithCheckboxItems = story({
  intent: 'Display a menu with checkbox items for toggle options',
  template: () => (
    <Menu open aria-label="View options">
      <MenuItemCheckbox aria-checked="true">Show grid</MenuItemCheckbox>
      <MenuItemCheckbox aria-checked="false">Show rulers</MenuItemCheckbox>
      <MenuItemCheckbox aria-checked="true">Show guides</MenuItemCheckbox>
    </Menu>
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

export const menuWithRadioItems = story({
  intent: 'Display a menu with radio items for exclusive selection',
  template: () => (
    <Menu open aria-label="Alignment">
      <MenuItemRadio aria-checked="true">Left</MenuItemRadio>
      <MenuItemRadio aria-checked="false">Center</MenuItemRadio>
      <MenuItemRadio aria-checked="false">Right</MenuItemRadio>
    </Menu>
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
  intent: 'Verify menu accessibility requirements',
  template: () => (
    <Menubar aria-label="Test menubar">
      <MenuItem>Item 1</MenuItem>
      <MenuItem>Item 2</MenuItem>
      <MenuItem>Item 3</MenuItem>
    </Menubar>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - menus use Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: No
- **Cleanup required**: Yes - type-ahead timeout cleanup in `onDisconnected`

## Keyboard Interaction

### Menubar

- **Tab/Shift+Tab**: Move focus into/out of menubar
- **ArrowRight/ArrowDown** (horizontal): Move focus to next item
- **ArrowLeft/ArrowUp** (horizontal): Move focus to previous item
- **ArrowDown** (horizontal): Open submenu if exists
- **Enter/Space**: Activate item or open submenu
- **Home**: Move focus to first item
- **End**: Move focus to last item
- **Escape**: Close all submenus
- **Type-ahead**: Jump to item starting with typed character

### Menu

- **ArrowDown**: Move focus to next item (wraps)
- **ArrowUp**: Move focus to previous item (wraps)
- **ArrowRight**: Open submenu if exists
- **ArrowLeft**: Close submenu, return to parent
- **Enter/Space**: Activate item
- **Home**: Move focus to first item
- **End**: Move focus to last item
- **Escape**: Close menu, return focus to trigger

### Menu Items

- **menuitemcheckbox**: Space toggles checked state (doesn't close menu)
- **menuitemradio**: Space checks item, unchecks others in group (doesn't close menu)

## WAI-ARIA Roles, States, and Properties

### Required

- **role="menubar"**: Container for persistent menu items
- **role="menu"**: Container for popup menu items
- **role="menuitem"**: Regular menu item
- **role="menuitemcheckbox"**: Checkbox menu item
- **role="menuitemradio"**: Radio menu item
- **role="separator"**: Visual divider between item groups

### Optional

- **aria-haspopup**: Set to `true` or `menu` for items with submenus
- **aria-expanded**: `true`/`false` for parent items with submenus
- **aria-checked**: `true`/`false` for checkbox/radio items
- **aria-disabled**: `true` for disabled items
- **aria-label** or **aria-labelledby**: Accessible name for menu/menubar
- **aria-activedescendant**: ID of focused item (for virtual focus)
- **aria-orientation**: `horizontal`/`vertical` (default: `horizontal` for menubar, `vertical` for menu)

## Best Practices

1. **Use bElement** - Menus require complex state and keyboard handling
2. **Use FunctionalTemplates** - for static menu item rendering
3. **Virtual focus** - Use `aria-activedescendant` instead of moving DOM focus
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Submenu positioning** - Position submenus relative to parent item
6. **Escape handling** - Return focus to trigger element when menu closes
7. **Separators** - Use for grouping related items
8. **Ellipsis convention** - Use "…" for items that open dialogs
9. **Type-ahead** - Implement for better keyboard navigation
10. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce menu structure and item states
- Keyboard users can navigate without mouse
- Focus indicators must be visible
- Submenus must be properly positioned and announced
- Checkbox/radio states must be clearly indicated
- Separators help organize menu structure
- Virtual focus (`aria-activedescendant`) keeps DOM focus on container

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- MDN: [ARIA menubar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menubar_role)
- MDN: [ARIA menu role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role)
- MDN: [ARIA menuitem role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menuitem_role)
- Related: [Menu Button Pattern](./aria-menubutton-pattern.md) - Opens menu from button
