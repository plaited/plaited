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

**Important**: In Plaited, menus and menubars are implemented as **bElements** because they require:
- Complex state management (open/closed menus, submenus, focus)
- Keyboard navigation (arrow keys, Tab, Enter, Space, Escape, type-ahead)
- Focus management with `aria-activedescendant`
- Submenu positioning and visibility
- Menu item state management (checkboxes, radio groups)

#### Menubar (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const menubarStyles = createStyles({
  menubar: {
    display: 'flex',
    gap: '0.25rem',
    padding: '0.5rem',
    backgroundColor: '#f0f0f0',
    borderBottom: '1px solid #ccc',
  },
  menuitem: {
    padding: '0.5rem 1rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '4px',
    backgroundColor: {
      $default: 'transparent',
      '[data-focused="true"]': '#007bff',
      '[aria-expanded="true"]': '#007bff',
      ':hover': '#e0e0e0',
    },
    color: {
      $default: 'inherit',
      '[data-focused="true"]': 'white',
      '[aria-expanded="true"]': 'white',
    },
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
    display: {
      $default: 'none',
      '[data-open="true"]': 'block',
    },
    zIndex: 1000,
  },
  submenuItem: {
    position: 'relative',
  },
  separator: {
    blockSize: '1px',
    backgroundColor: '#ccc',
    marginBlock: '0.25rem',
    border: 'none',
  },
})

type MenubarEvents = {
  select: { value: string; item: HTMLElement }
  activate: { value: string; item: HTMLElement }
}

export const Menubar = bElement<MenubarEvents>({
  tag: 'accessible-menubar',
  observedAttributes: ['aria-label', 'aria-orientation'],
  shadowDom: (
    <nav
      p-target='menubar'
      role='menubar'
      tabIndex={0}
      {...menubarStyles.menubar}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <slot name='items'></slot>
    </nav>
  ),
  bProgram({ $, host, emit, root }) {
    const menubar = $('menubar')[0]
    let items: HTMLElement[] = []
    let focusedIndex = -1
    let openSubmenuIndex = -1
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined
    const isVertical = host.getAttribute('aria-orientation') === 'vertical'

    const getItems = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
      ) as HTMLElement[]
    }

    const getSubmenu = (item: HTMLElement): HTMLElement | null => {
      // Submenu is the next sibling with role="menu"
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
      items.forEach((item, index) => {
        const submenu = getSubmenu(item)
        if (submenu) {
          item.attr('aria-expanded', 'false')
          submenu.setAttribute('data-open', 'false')
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
      
      // Close other submenus
      closeAllSubmenus()
      
      // Open this submenu
      item.attr('aria-expanded', 'true')
      submenu.setAttribute('data-open', 'true')
      submenu.removeAttribute('hidden')
      openSubmenuIndex = index
      
      // Focus first item in submenu
      const submenuItems = Array.from(submenu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')) as HTMLElement[]
      if (submenuItems.length > 0) {
        // Use aria-activedescendant for submenu
        const firstItem = submenuItems[0]
        const id = firstItem.id || `submenu-item-${index}-0`
        if (!firstItem.id) firstItem.id = id
        submenu.setAttribute('aria-activedescendant', id)
        firstItem.setAttribute('data-focused', 'true')
      }
    }

    const updateActiveDescendant = () => {
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        const focusedItem = items[focusedIndex]
        const id = focusedItem.id || `menuitem-${focusedIndex}`
        if (!focusedItem.id) {
          focusedItem.id = id
        }
        menubar?.attr('aria-activedescendant', id)
        focusedItem.setAttribute('data-focused', 'true')
      } else {
        menubar?.attr('aria-activedescendant', null)
      }
      
      // Remove focus from other items
      items.forEach((item, idx) => {
        if (idx !== focusedIndex) {
          item.removeAttribute('data-focused')
        }
      })
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
        // Open submenu
        if (isVertical) {
          openSubmenu(index)
        } else {
          // Horizontal: ArrowDown opens submenu
          openSubmenu(index)
        }
      } else {
        // Activate item
        if (role === 'menuitemcheckbox') {
          const checked = item.getAttribute('aria-checked') === 'true'
          item.attr('aria-checked', checked ? 'false' : 'true')
        } else if (role === 'menuitemradio') {
          // Uncheck others in same group
          const group = item.closest('[role="menu"]')
          if (group) {
            Array.from(group.querySelectorAll('[role="menuitemradio"]')).forEach(radio => {
              radio.setAttribute('aria-checked', 'false')
            })
          }
          item.attr('aria-checked', 'true')
        }
        
        const value = item.getAttribute('data-value') || item.textContent || ''
        emit({ type: 'activate', detail: { value, item } })
        emit({ type: 'select', detail: { value, item } })
        
        // Close all menus
        closeAllSubmenus()
      }
    }

    const handleTypeAhead = (char: string) => {
      typeAheadBuffer += char.toLowerCase()
      
      if (typeAheadTimeout) {
        clearTimeout(typeAheadTimeout)
      }
      
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
          case isVertical ? 'ArrowDown' : 'ArrowRight':
            event.preventDefault()
            moveFocus('next')
            break
            
          case isVertical ? 'ArrowUp' : 'ArrowLeft':
            event.preventDefault()
            moveFocus('prev')
            break
            
          case isVertical ? 'ArrowRight' : 'ArrowDown':
            event.preventDefault()
            // Open submenu if exists
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
            // Tab moves focus out of menubar
            closeAllSubmenus()
            break
            
          default:
            // Type-ahead
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
        
        // Focus first item or last focused item
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
        
        // Set tabindex on items
        items.forEach((item, index) => {
          if (index === 0) {
            item.setAttribute('tabindex', '0')
          } else {
            item.setAttribute('tabindex', '-1')
          }
        })
        
        // Set aria-label if provided
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          menubar?.attr('aria-label', ariaLabel)
        }
        
        // Set orientation
        if (isVertical) {
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
```

#### Menu (Popup Menu) (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const menuStyles = createStyles({
  menu: {
    position: 'absolute',
    minWidth: '200px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    listStyle: 'none',
    padding: '0.25rem',
    margin: 0,
    outline: 'none',
    zIndex: 1000,
    display: {
      $default: 'none',
      '[data-open="true"]': 'block',
    },
  },
  menuitem: {
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '4px',
    backgroundColor: {
      $default: 'transparent',
      '[data-focused="true"]': '#007bff',
      ':hover': '#f0f0f0',
    },
    color: {
      $default: 'inherit',
      '[data-focused="true"]': 'white',
    },
  },
  separator: {
    blockSize: '1px',
    backgroundColor: '#ccc',
    marginBlock: '0.25rem',
    marginInline: 0,
    border: 'none',
  },
})

type MenuEvents = {
  select: { value: string; item: HTMLElement }
  activate: { value: string; item: HTMLElement }
}

export const Menu = bElement<MenuEvents>({
  tag: 'accessible-menu',
  observedAttributes: ['open', 'aria-label'],
  shadowDom: (
    <ul
      p-target='menu'
      role='menu'
      tabIndex={-1}
      {...menuStyles.menu}
      data-open='false'
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus' }}
    >
      <slot name='items'></slot>
    </ul>
  ),
  bProgram({ $, host, emit, root }) {
    const menu = $('menu')[0]
    let items: HTMLElement[] = []
    let focusedIndex = -1
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined

    const getItems = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
      ) as HTMLElement[]
    }

    const updateActiveDescendant = () => {
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        const focusedItem = items[focusedIndex]
        const id = focusedItem.id || `menuitem-${focusedIndex}`
        if (!focusedItem.id) {
          focusedItem.id = id
        }
        menu?.attr('aria-activedescendant', id)
        focusedItem.setAttribute('data-focused', 'true')
      } else {
        menu?.attr('aria-activedescendant', null)
      }
      
      items.forEach((item, idx) => {
        if (idx !== focusedIndex) {
          item.removeAttribute('data-focused')
        }
      })
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
      const hasSubmenu = item.getAttribute('aria-haspopup') === 'true' || item.getAttribute('aria-haspopup') === 'menu'
      
      if (hasSubmenu) {
        // Open submenu (handled by parent)
        // This would need coordination with parent menu/menubar
      } else {
        if (role === 'menuitemcheckbox') {
          const checked = item.getAttribute('aria-checked') === 'true'
          item.attr('aria-checked', checked ? 'false' : 'true')
        } else if (role === 'menuitemradio') {
          const group = item.closest('[role="menu"]')
          if (group) {
            Array.from(group.querySelectorAll('[role="menuitemradio"]')).forEach(radio => {
              radio.setAttribute('aria-checked', 'false')
            })
          }
          item.attr('aria-checked', 'true')
        }
        
        const value = item.getAttribute('data-value') || item.textContent || ''
        emit({ type: 'activate', detail: { value, item } })
        emit({ type: 'select', detail: { value, item } })
        
        // Close menu
        closeMenu()
      }
    }

    const openMenu = () => {
      menu?.setAttribute('data-open', 'true')
      menu?.removeAttribute('hidden')
      menu?.focus()
      items = getItems()
      if (items.length > 0) {
        focusedIndex = 0
        updateActiveDescendant()
      }
    }

    const closeMenu = () => {
      menu?.setAttribute('data-open', 'false')
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
            
          case 'ArrowRight':
            event.preventDefault()
            // Open submenu if exists
            if (focusedIndex >= 0) {
              const item = items[focusedIndex]
              const hasSubmenu = item.getAttribute('aria-haspopup') === 'true' || item.getAttribute('aria-haspopup') === 'menu'
              if (hasSubmenu) {
                // Trigger submenu open (would need parent coordination)
              }
            }
            break
            
          case 'ArrowLeft':
            event.preventDefault()
            // Close submenu and return to parent (would need parent coordination)
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
            // Return focus to trigger element (would need parent coordination)
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
```

#### Menu Item Components (Functional Templates)

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'

// Regular menu item
const MenuItem: FT<{
  'aria-haspopup'?: 'true' | 'false' | 'menu'
  'aria-expanded'?: 'true' | 'false'
  children?: Children
}> = ({ 'aria-haspopup': ariaHasPopup, 'aria-expanded': ariaExpanded, children, ...attrs }) => (
  <button
    role='menuitem'
    aria-haspopup={ariaHasPopup}
    aria-expanded={ariaExpanded}
    tabIndex={-1}
    {...attrs}
    {...joinStyles(menuStyles.menuitem)}
  >
    {children}
  </button>
)

// Menu item checkbox
const MenuItemCheckbox: FT<{
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ 'aria-checked': ariaChecked, children, ...attrs }) => (
  <div
    role='menuitemcheckbox'
    aria-checked={ariaChecked}
    tabIndex={0}
    {...attrs}
    {...joinStyles(menuStyles.menuitem)}
  >
    {ariaChecked === 'true' ? '✓ ' : ''}{children}
  </div>
)

// Menu item radio
const MenuItemRadio: FT<{
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ 'aria-checked': ariaChecked, children, ...attrs }) => (
  <div
    role='menuitemradio'
    aria-checked={ariaChecked}
    tabIndex={0}
    {...attrs}
    {...joinStyles(menuStyles.menuitem)}
  >
    {ariaChecked === 'true' ? '● ' : '○ '}{children}
  </div>
)

// Separator
const MenuSeparator: FT = () => (
  <li role='separator' aria-orientation='horizontal' {...menuStyles.separator}></li>
)
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - menus use Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `p-trigger` for events
- **Requires external web API**: No - uses standard DOM APIs
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
2. **Virtual focus** - Use `aria-activedescendant` instead of moving DOM focus
3. **Submenu positioning** - Position submenus relative to parent item
4. **Escape handling** - Return focus to trigger element when menu closes
5. **Separators** - Use for grouping related items
6. **Ellipsis convention** - Use "…" for items that open dialogs
7. **Type-ahead** - Implement for better keyboard navigation
8. **Menu labels** - Always provide accessible names
9. **Disabled items** - Keep focusable but prevent activation
10. **Submenu coordination** - Close other submenus when opening a new one

## Accessibility Considerations

- Screen readers announce menu structure and item states
- Keyboard users can navigate without mouse
- Focus indicators must be visible
- Submenus must be properly positioned and announced
- Checkbox/radio states must be clearly indicated
- Separators help organize menu structure
- Virtual focus (`aria-activedescendant`) keeps DOM focus on container

## Menu Variants

### Menubar
- Visually persistent
- Typically horizontal
- Application navigation
- Quick access to commands

### Popup Menu
- Appears on demand
- Typically vertical
- Context menus
- Action menus

### Submenu
- Nested menu from parent item
- Opens on ArrowRight or Enter
- Closes on ArrowLeft or Escape

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA menu pattern has universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- MDN: [ARIA menubar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menubar_role)
- MDN: [ARIA menu role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role)
- MDN: [ARIA menuitem role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menuitem_role)
- Related: [Menu Button Pattern](./aria-menubutton-pattern.md) - Opens menu from button
