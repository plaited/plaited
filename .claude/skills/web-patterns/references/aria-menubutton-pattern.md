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

**Common Use Cases:**
- Action menus (dropdown actions)
- Navigation menu buttons
- Settings/preferences menus
- Context menu triggers
- Command palettes

## Use Cases

- Dropdown action buttons ("Actions ▼")
- Navigation menu buttons
- Settings/preferences menus
- Filter/sort controls
- User account menus
- Language selector buttons
- Theme switcher buttons

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

**Important**: In Plaited, menu buttons are implemented as **bElements** because they require:
- State management (open/closed menu)
- Keyboard interaction (Enter, Space, optional Arrow keys)
- Focus coordination with menu
- Menu positioning and visibility

The button itself can be a Functional Template, but the menu button widget (button + menu coordination) is a bElement.

#### Menu Button (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const menuButtonStyles = createStyles({
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  button: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: {
      $default: 'white',
      ':hover': '#f0f0f0',
      '[aria-expanded="true"]': '#007bff',
    },
    color: {
      $default: 'inherit',
      '[aria-expanded="true"]': 'white',
    },
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  icon: {
    fontSize: '0.75em',
    transition: 'transform 0.2s',
    transform: {
      $default: 'rotate(0deg)',
      '[aria-expanded="true"]': 'rotate(180deg)',
    },
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
    display: {
      $default: 'none',
      '[data-open="true"]': 'block',
    },
  },
})

type MenuButtonEvents = {
  open: { button: HTMLElement }
  close: { button: HTMLElement }
  select: { value: string; item: HTMLElement }
}

export const MenuButton = bElement<MenuButtonEvents>({
  tag: 'menu-button',
  observedAttributes: ['open', 'aria-label'],
  shadowDom: (
    <div p-target='container' {...menuButtonStyles.container}>
      <button
        p-target='button'
        type='button'
        role='button'
        aria-haspopup='menu'
        aria-expanded='false'
        aria-controls='menu'
        {...menuButtonStyles.button}
        p-trigger={{ click: 'toggleMenu', keydown: 'handleButtonKeydown' }}
      >
        <slot name='label'>Menu</slot>
        <span aria-hidden='true' p-target='icon' {...menuButtonStyles.icon}>
          ▼
        </span>
      </button>
      <ul
        p-target='menu'
        role='menu'
        id='menu'
        aria-label='Menu'
        data-open='false'
        hidden
        {...menuButtonStyles.menu}
        p-trigger={{ keydown: 'handleMenuKeydown' }}
      >
        <slot name='items'></slot>
      </ul>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const button = $<HTMLButtonElement>('button')[0]
    const menu = $('menu')[0]
    let isOpen = false
    let previousActiveElement: HTMLElement | null = null

    const openMenu = () => {
      if (isOpen) return
      
      isOpen = true
      previousActiveElement = document.activeElement as HTMLElement
      
      button?.attr('aria-expanded', 'true')
      menu?.setAttribute('data-open', 'true')
      menu?.removeAttribute('hidden')
      
      // Focus first menu item
      const firstItem = menu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]') as HTMLElement
      if (firstItem) {
        const id = firstItem.id || 'menu-item-0'
        if (!firstItem.id) firstItem.id = id
        menu?.setAttribute('aria-activedescendant', id)
        firstItem.setAttribute('data-focused', 'true')
      }
      
      // Focus menu container for keyboard navigation
      menu?.focus()
      
      emit({ type: 'open', detail: { button: button! } })
    }

    const closeMenu = () => {
      if (!isOpen) return
      
      isOpen = false
      
      button?.attr('aria-expanded', 'false')
      menu?.setAttribute('data-open', 'false')
      menu?.setAttribute('hidden', '')
      menu?.removeAttribute('aria-activedescendant')
      
      // Remove focus from menu items
      menu?.querySelectorAll('[data-focused]').forEach(item => {
        item.removeAttribute('data-focused')
      })
      
      // Return focus to button
      button?.focus()
      
      emit({ type: 'close', detail: { button: button! } })
    }

    const handleMenuSelection = (item: HTMLElement) => {
      const value = item.getAttribute('data-value') || item.textContent || ''
      emit({ type: 'select', detail: { value, item } })
      closeMenu()
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
            if (!isOpen) {
              openMenu()
            }
            break
            
          case 'ArrowDown':
            event.preventDefault()
            if (!isOpen) {
              openMenu()
            }
            break
            
          case 'ArrowUp':
            event.preventDefault()
            if (!isOpen) {
              openMenu()
              // Focus last menu item
              const items = Array.from(
                menu?.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]') || []
              ) as HTMLElement[]
              if (items.length > 0) {
                const lastItem = items[items.length - 1]
                const id = lastItem.id || `menu-item-${items.length - 1}`
                if (!lastItem.id) lastItem.id = id
                menu?.setAttribute('aria-activedescendant', id)
                lastItem.setAttribute('data-focused', 'true')
              }
            }
            break
        }
      },
      
      handleMenuKeydown(event: KeyboardEvent) {
        if (!isOpen) return
        
        const items = Array.from(
          menu?.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]') || []
        ) as HTMLElement[]
        
        if (items.length === 0) return
        
        const currentFocusedId = menu?.getAttribute('aria-activedescendant')
        const currentIndex = items.findIndex(item => item.id === currentFocusedId)
        
        switch (event.key) {
          case 'Escape':
            event.preventDefault()
            closeMenu()
            break
            
          case 'ArrowDown':
            event.preventDefault()
            const nextIndex = (currentIndex + 1) % items.length
            const nextItem = items[nextIndex]
            const nextId = nextItem.id || `menu-item-${nextIndex}`
            if (!nextItem.id) nextItem.id = nextId
            menu?.setAttribute('aria-activedescendant', nextId)
            items.forEach((item, idx) => {
              if (idx === nextIndex) {
                item.setAttribute('data-focused', 'true')
              } else {
                item.removeAttribute('data-focused')
              }
            })
            nextItem.scrollIntoView({ block: 'nearest' })
            break
            
          case 'ArrowUp':
            event.preventDefault()
            const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
            const prevItem = items[prevIndex]
            const prevId = prevItem.id || `menu-item-${prevIndex}`
            if (!prevItem.id) prevItem.id = prevId
            menu?.setAttribute('aria-activedescendant', prevId)
            items.forEach((item, idx) => {
              if (idx === prevIndex) {
                item.setAttribute('data-focused', 'true')
              } else {
                item.removeAttribute('data-focused')
              }
            })
            prevItem.scrollIntoView({ block: 'nearest' })
            break
            
          case 'Enter':
          case ' ':
            event.preventDefault()
            if (currentIndex >= 0 && currentIndex < items.length) {
              const item = items[currentIndex]
              const role = item.getAttribute('role')
              
              if (role === 'menuitemcheckbox') {
                const checked = item.getAttribute('aria-checked') === 'true'
                item.setAttribute('aria-checked', checked ? 'false' : 'true')
              } else if (role === 'menuitemradio') {
                // Uncheck others in same group
                items.forEach(radio => {
                  if (radio.getAttribute('role') === 'menuitemradio') {
                    radio.setAttribute('aria-checked', 'false')
                  }
                })
                item.setAttribute('aria-checked', 'true')
              } else {
                handleMenuSelection(item)
              }
            }
            break
            
          case 'Home':
            event.preventDefault()
            if (items.length > 0) {
              const firstItem = items[0]
              const firstId = firstItem.id || 'menu-item-0'
              if (!firstItem.id) firstItem.id = firstId
              menu?.setAttribute('aria-activedescendant', firstId)
              items.forEach((item, idx) => {
                if (idx === 0) {
                  item.setAttribute('data-focused', 'true')
                } else {
                  item.removeAttribute('data-focused')
                }
              })
              firstItem.scrollIntoView({ block: 'nearest' })
            }
            break
            
          case 'End':
            event.preventDefault()
            if (items.length > 0) {
              const lastItem = items[items.length - 1]
              const lastId = lastItem.id || `menu-item-${items.length - 1}`
              if (!lastItem.id) lastItem.id = lastId
              menu?.setAttribute('aria-activedescendant', lastId)
              items.forEach((item, idx) => {
                if (idx === items.length - 1) {
                  item.setAttribute('data-focused', 'true')
                } else {
                  item.removeAttribute('data-focused')
                }
              })
              lastItem.scrollIntoView({ block: 'nearest' })
            }
            break
        }
      },
      
      onConnected() {
        // Initialize from open attribute
        if (host.hasAttribute('open')) {
          openMenu()
        }
        
        // Set aria-label if provided
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          button?.setAttribute('aria-label', ariaLabel)
          menu?.setAttribute('aria-label', ariaLabel)
        }
        
        // Handle clicks outside menu to close
        const handleClickOutside = (event: MouseEvent) => {
          if (isOpen && !root.contains(event.target as Node)) {
            closeMenu()
          }
        }
        
        document.addEventListener('click', handleClickOutside)
        
        // Cleanup on disconnect
        return {
          onDisconnected() {
            document.removeEventListener('click', handleClickOutside)
          },
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
```

#### Action Menu Button Example

```typescript
// Usage in story
export const actionMenuButton = story({
  intent: 'Menu button with action items',
  template: () => (
    <MenuButton aria-label='Actions'>
      <span slot='label'>Actions</span>
      <li slot='items' role='menuitem' data-value='edit'>Edit</li>
      <li slot='items' role='menuitem' data-value='delete'>Delete</li>
      <li slot='items' role='separator' aria-orientation='horizontal'></li>
      <li slot='items' role='menuitem' data-value='share'>Share</li>
    </MenuButton>
  ),
})
```

#### Navigation Menu Button Example

```typescript
// Navigation menu button (using link as button)
export const NavigationMenuButton = bElement<MenuButtonEvents>({
  tag: 'nav-menu-button',
  observedAttributes: ['open', 'aria-label'],
  shadowDom: (
    <div p-target='container' {...menuButtonStyles.container}>
      <a
        p-target='button'
        role='button'
        href='#'
        aria-haspopup='menu'
        aria-expanded='false'
        aria-controls='menu'
        {...menuButtonStyles.button}
        p-trigger={{ click: 'toggleMenu', keydown: 'handleButtonKeydown' }}
      >
        <slot name='label'>Navigation</slot>
        <span aria-hidden='true' p-target='icon' {...menuButtonStyles.icon}>
          ▼
        </span>
      </a>
      <ul
        p-target='menu'
        role='menu'
        id='menu'
        aria-label='Navigation'
        data-open='false'
        hidden
        {...menuButtonStyles.menu}
        p-trigger={{ keydown: 'handleMenuKeydown' }}
      >
        <slot name='items'></slot>
      </ul>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    // Same implementation as MenuButton above
    // ...
  },
})
```

#### Menu Button with Checkboxes

```typescript
export const menuButtonWithCheckboxes = story({
  intent: 'Menu button with checkbox items',
  template: () => (
    <MenuButton aria-label='View options'>
      <span slot='label'>View</span>
      <li slot='items' role='menuitemcheckbox' aria-checked='true' data-value='grid'>
        Show grid
      </li>
      <li slot='items' role='menuitemcheckbox' aria-checked='false' data-value='rulers'>
        Show rulers
      </li>
    </MenuButton>
  ),
})
```

#### Menu Button with Radio Items

```typescript
export const menuButtonWithRadio = story({
  intent: 'Menu button with radio items',
  template: () => (
    <MenuButton aria-label='Alignment'>
      <span slot='label'>Align</span>
      <li slot='items' role='menuitemradio' aria-checked='true' data-value='left'>
        Left
      </li>
      <li slot='items' role='menuitemradio' aria-checked='false' data-value='center'>
        Center
      </li>
      <li slot='items' role='menuitemradio' aria-checked='false' data-value='right'>
        Right
      </li>
    </MenuButton>
  ),
})
```

#### Menu Item Components (Functional Templates)

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'

const menuItemStyles = createStyles({
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
})

const MenuItem: FT<{
  value?: string
  children?: Children
}> = ({ value, children, ...attrs }) => (
  <li
    role='menuitem'
    data-value={value}
    {...attrs}
    {...joinStyles(menuItemStyles.menuitem)}
    p-trigger={{ click: 'selectItem' }}
  >
    {children}
  </li>
)

const MenuItemCheckbox: FT<{
  value?: string
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-checked': ariaChecked, children, ...attrs }) => (
  <li
    role='menuitemcheckbox'
    data-value={value}
    aria-checked={ariaChecked}
    {...attrs}
    {...joinStyles(menuItemStyles.menuitem)}
  >
    {ariaChecked === 'true' ? '✓ ' : ''}{children}
  </li>
)

const MenuItemRadio: FT<{
  value?: string
  'aria-checked': 'true' | 'false'
  children?: Children
}> = ({ value, 'aria-checked': ariaChecked, children, ...attrs }) => (
  <li
    role='menuitemradio'
    data-value={value}
    aria-checked={ariaChecked}
    {...attrs}
    {...joinStyles(menuItemStyles.menuitem)}
  >
    {ariaChecked === 'true' ? '● ' : '○ '}{children}
  </li>
)

const MenuSeparator: FT = () => (
  <li role='separator' aria-orientation='horizontal' style={{ blockSize: '1px', backgroundColor: '#ccc', marginBlock: '0.25rem' }}></li>
)
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - menu button uses Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `p-trigger` for events
- **Requires external web API**: No - uses standard DOM APIs
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
2. **Visual indicator** - Include downward arrow/triangle icon
3. **Focus management** - Return focus to button when menu closes
4. **Click outside** - Close menu when clicking outside
5. **Keyboard shortcuts** - Support Enter, Space, optional Arrow keys
6. **Menu positioning** - Position menu relative to button
7. **Accessible names** - Provide `aria-label` for button and menu
8. **Virtual focus** - Use `aria-activedescendant` for menu navigation
9. **Escape handling** - Close menu and return focus on Escape
10. **Checkbox/Radio behavior** - Don't close menu on Space for checkboxes/radios

## Accessibility Considerations

- Screen readers announce button state and menu structure
- Keyboard users can open and navigate menu without mouse
- Focus indicators must be visible
- Menu must be properly positioned and announced
- Focus returns to button when menu closes
- Checkbox/radio states must be clearly indicated
- Menu items must be keyboard accessible

## Menu Button Variants

### Action Menu Button
- Opens menu of actions/commands
- Typically uses regular menuitem items
- Closes on selection

### Navigation Menu Button
- Opens navigation menu
- May use links as menu items
- Can be implemented with `<a>` element as button

### Settings Menu Button
- Opens settings/preferences menu
- May include checkboxes and radio items
- Checkboxes/radios don't close menu on activation

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA menu button pattern has universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- Related: [Menu and Menubar Pattern](./aria-menubar-pattern.md) - Menu implementation details
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
- MDN: [ARIA menu role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role)
