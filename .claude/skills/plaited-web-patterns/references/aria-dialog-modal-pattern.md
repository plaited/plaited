# ARIA Dialog (Modal) Pattern

## Overview

A dialog is a window overlaid on either the primary window or another dialog window. Windows under a modal dialog are inert. That is, users cannot interact with content outside an active dialog window. Inert content outside an active dialog is typically visually obscured or dimmed so it is difficult to discern, and in some implementations, attempts to interact with the inert content cause the dialog to close.

**Key Characteristics:**
- **Modal**: Blocks interaction with content outside the dialog
- **Focus trapping**: Tab and Shift+Tab do not move focus outside the dialog
- **Escape key**: Closes the dialog
- **Focus management**: Moves focus into dialog on open, returns focus on close
- **Visual overlay**: Typically dims or obscures background content

**Differences from Alert Dialog:**
- Modal dialogs use `role="dialog"` (not `role="alertdialog"`)
- Modal dialogs are for general-purpose dialogs, not just critical alerts
- Alert dialogs are a specialized type of modal dialog

## Use Cases

- Form dialogs (user input, settings)
- Confirmation dialogs (non-critical)
- Content viewers (images, details)
- Multi-step wizards
- Date/time pickers
- File upload dialogs
- Settings panels

## Implementation

### Vanilla JavaScript

```html
<div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
  hidden
>
  <h2 id="dialog-title">Dialog Title</h2>
  <p id="dialog-description">Dialog description text</p>
  <button>Close</button>
</div>
```

```javascript
// Show modal dialog
function showDialog(dialog, triggerElement) {
  // Store trigger for focus return
  dialog.dataset.triggerId = triggerElement.id
  
  // Show dialog
  dialog.hidden = false
  dialog.setAttribute('aria-modal', 'true')
  
  // Trap focus - get all focusable elements
  const focusableElements = dialog.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]
  
  // Focus first element
  firstFocusable?.focus()
  
  // Handle Tab trapping
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }
    if (e.key === 'Escape') {
      closeDialog(dialog)
    }
  })
}

// Close dialog
function closeDialog(dialog) {
  dialog.hidden = true
  
  // Return focus to trigger
  const triggerId = dialog.dataset.triggerId
  const trigger = document.getElementById(triggerId)
  trigger?.focus()
}
```

### Plaited Adaptation

**Important**: In Plaited, modal dialogs are implemented as **bElements** because they require:
- Complex state management (open/closed)
- Focus trapping
- Keyboard event handling (Tab, Escape)
- Modal overlay management
- Return focus to trigger element

#### Modal Dialog bElement (Custom Implementation)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles, createHostStyles } from 'plaited/ui'

const dialogStyles = createStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    inlineSize: '100%',
    blockSize: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: {
      $default: 'none',
      '[data-open="true"]': 'flex',
    },
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    maxInlineSize: '600px',
    inline-size: '90%',
    maxBlockSize: '90vh',
    overflowY: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  title: {
    marginBlockEnd: '1rem',
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  content: {
    marginBlockEnd: '1.5rem',
  },
  footer: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
})

const dialogHostStyles = createHostStyles({
  display: 'block',
})

type ModalDialogEvents = {
  close: undefined
  open: undefined
}

export const ModalDialog = bElement<ModalDialogEvents>({
  tag: 'modal-dialog',
  observedAttributes: ['open'],
  hostStyles: dialogHostStyles,
  shadowDom: (
    <div
      p-target='overlay'
      {...dialogStyles.overlay}
      data-open='false'
      p-trigger={{ click: 'handleOverlayClick', keydown: 'handleKeydown' }}
    >
      <div
        p-target='dialog'
        role='dialog'
        aria-modal='true'
        {...dialogStyles.dialog}
        p-trigger={{ click: 'handleDialogClick' }}
      >
        <h2
          p-target='title'
          id='dialog-title'
          {...dialogStyles.title}
        >
          <slot name='title'>Dialog Title</slot>
        </h2>
        <div
          p-target='content'
          id='dialog-description'
          {...dialogStyles.content}
        >
          <slot name='content'></slot>
        </div>
        <div {...dialogStyles.footer}>
          <slot name='footer'>
            <button
              type='button'
              p-target='close-button'
              p-trigger={{ click: 'close' }}
              {...dialogStyles.button}
            >
              Close
            </button>
          </slot>
        </div>
      </div>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const overlay = $('overlay')[0]
    const dialog = $('dialog')[0]
    const title = $('title')[0]
    const content = $('content')[0]
    
    let previousActiveElement: HTMLElement | null = null
    let focusableElements: HTMLElement[] = []
    let escapeHandler: ((e: KeyboardEvent) => void) | undefined

    const getFocusableElements = () => {
      if (!dialog) return []
      
      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      return Array.from(dialog.querySelectorAll(selector)) as HTMLElement[]
    }

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }
      
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement
      
      if (event.shiftKey) {
        // Shift + Tab
        if (activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    const openDialog = () => {
      // Store element that had focus before opening
      previousActiveElement = document.activeElement as HTMLElement
      
      // Show dialog
      overlay?.attr('data-open', 'true')
      host.setAttribute('open', '')
      
      // Set ARIA attributes
      dialog?.attr('aria-modal', 'true')
      if (title) {
        dialog?.attr('aria-labelledby', 'dialog-title')
      }
      if (content) {
        dialog?.attr('aria-describedby', 'dialog-description')
      }
      
      // Get focusable elements
      focusableElements = getFocusableElements()
      
      // Set initial focus
      // Option 1: Focus first focusable element
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      } else if (title) {
        // Option 2: Focus title if no focusable elements
        title.setAttribute('tabindex', '-1')
        title.focus()
      }
      
      // Handle Escape key
      escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeDialog()
        }
      }
      document.addEventListener('keydown', escapeHandler)
      
      emit({ type: 'open' })
    }

    const closeDialog = () => {
      overlay?.attr('data-open', 'false')
      host.removeAttribute('open')
      
      // Remove escape handler
      if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler)
        escapeHandler = undefined
      }
      
      // Return focus to previous element
      previousActiveElement?.focus()
      previousActiveElement = null
      
      emit({ type: 'close' })
    }

    return {
      close() {
        closeDialog()
      },
      handleOverlayClick(event: MouseEvent) {
        // Close if clicking overlay (not dialog content)
        if (event.target === overlay) {
          closeDialog()
        }
      },
      handleDialogClick(event: MouseEvent) {
        // Prevent clicks inside dialog from closing
        event.stopPropagation()
      },
      handleKeydown(event: KeyboardEvent) {
        trapFocus(event)
      },
      onConnected() {
        // Initialize ARIA attributes
        if (title) {
          dialog?.attr('aria-labelledby', 'dialog-title')
        }
        if (content) {
          dialog?.attr('aria-describedby', 'dialog-description')
        }
      },
      onDisconnected() {
        // Cleanup escape handler
        if (escapeHandler) {
          document.removeEventListener('keydown', escapeHandler)
          escapeHandler = undefined
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'open') {
          if (newValue !== null) {
            openDialog()
          } else {
            closeDialog()
          }
        }
      },
    }
  },
})
```

#### Using Native `<dialog>` Element

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const dialogStyles = createStyles({
  dialog: {
    padding: '1.5rem',
    borderRadius: '8px',
    border: 'none',
    maxInlineSize: '600px',
    inlineSize: '90%',
    maxBlockSize: '90vh',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  title: {
    marginBlockEnd: '1rem',
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
})

type ModalDialogEvents = {
  close: undefined
  open: undefined
}

export const NativeModalDialog = bElement<ModalDialogEvents>({
  tag: 'native-modal-dialog',
  observedAttributes: ['open'],
  shadowDom: (
    <dialog
      p-target='dialog'
      role='dialog'
      aria-modal='true'
      aria-labelledby='dialog-title'
      {...dialogStyles.dialog}
    >
      <h2
        p-target='title'
        id='dialog-title'
        {...dialogStyles.title}
      >
        <slot name='title'>Dialog Title</slot>
      </h2>
      <div
        p-target='content'
        id='dialog-description'
      >
        <slot name='content'></slot>
      </div>
      <div>
        <slot name='footer'>
          <button
            type='button'
            p-target='close-button'
            p-trigger={{ click: 'close' }}
          >
            Close
          </button>
        </slot>
      </div>
    </dialog>
  ),
  bProgram({ $, host, emit }) {
    const dialog = $<HTMLDialogElement>('dialog')[0]
    let previousActiveElement: HTMLElement | null = null

    const openDialog = () => {
      previousActiveElement = document.activeElement as HTMLElement
      dialog?.showModal()
      host.setAttribute('open', '')
      emit({ type: 'open' })
    }

    const closeDialog = () => {
      dialog?.close()
      host.removeAttribute('open')
      previousActiveElement?.focus()
      previousActiveElement = null
      emit({ type: 'close' })
    }

    return {
      close() {
        closeDialog()
      },
      onConnected() {
        // Handle native dialog close (Escape key, backdrop click)
        dialog?.addEventListener('close', () => {
          host.removeAttribute('open')
          previousActiveElement?.focus()
          previousActiveElement = null
          emit({ type: 'close' })
        })
        
        // Style backdrop
        if (dialog) {
          // Backdrop styling via CSS
          const style = document.createElement('style')
          style.textContent = `
            dialog::backdrop {
              background-color: rgba(0, 0, 0, 0.5);
            }
          `
          dialog.appendChild(style)
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'open') {
          if (newValue !== null) {
            openDialog()
          } else {
            closeDialog()
          }
        }
      },
    }
  },
})
```

#### Dialog with Initial Focus on Title

```typescript
// For dialogs with complex content that needs to be read first
export const ContentDialog = bElement({
  tag: 'content-dialog',
  observedAttributes: ['open'],
  shadowDom: (
    <div
      p-target='overlay'
      role='dialog'
      aria-modal='true'
      aria-labelledby='dialog-title'
    >
      <h2
        p-target='title'
        id='dialog-title'
        tabIndex={-1}
      >
        <slot name='title'></slot>
      </h2>
      <div
        p-target='content'
        id='dialog-description'
      >
        <slot name='content'></slot>
      </div>
      <slot name='footer'></slot>
    </div>
  ),
  bProgram({ $ }) {
    const title = $('title')[0]
    
    return {
      onAttributeChanged({ name, newValue }) {
        if (name === 'open' && newValue !== null) {
          // Focus title first for screen readers
          title?.focus()
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - dialogs are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for button clicks, keyboard events, overlay clicks
  - `p-target` for element selection with `$()`
  - `attr()` helper for managing ARIA attributes and visibility
  - `observedAttributes` for reactive open/close state
  - Native `<dialog>` element support (optional)
- **Requires external web API**: 
  - Native `<dialog>` element (if using native implementation)
  - Focus management APIs (focus(), activeElement)
  - Keyboard event handling
- **Cleanup required**: Yes - remove event listeners in `onDisconnected` if using custom implementation

## Keyboard Interaction

- **Tab**: Moves focus to the next tabbable element within the dialog
- **Shift + Tab**: Moves focus to the previous tabbable element within the dialog
- **Escape**: Closes the dialog and returns focus to the trigger element
- **Focus trapping**: Focus cannot move outside the dialog when open

**Note**: If using native `<dialog>` element, focus trapping and Escape key handling are handled automatically by the browser.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="dialog"**: Identifies the element as a dialog
- **aria-modal="true"**: Indicates the dialog is modal (blocks interaction outside)
- **aria-labelledby** or **aria-label**: Accessible label for the dialog (usually the title)

### Optional

- **aria-describedby**: ID reference to element containing dialog description
- **tabindex="-1"**: On static elements that should receive initial focus (e.g., title)

## Best Practices

1. **Use bElement** - Modal dialogs require complex state management and focus trapping
2. **Consider native `<dialog>`** - Modern browsers provide built-in focus trapping and backdrop
3. **Store previous focus** - Always return focus to the element that triggered the dialog
4. **Trap focus** - Keep keyboard focus within the dialog when open
5. **Handle Escape key** - Allow users to close the dialog with Escape
6. **Set appropriate initial focus**:
   - First focusable element (most common)
   - Dialog title (for complex content that needs reading)
   - Least destructive action (for critical dialogs)
7. **Provide close button** - Include a visible close button in the dialog
8. **Handle overlay clicks** - Optionally close when clicking outside dialog
9. **Clean up event listeners** - Remove keyboard handlers when dialog closes
10. **Use semantic HTML** - Use heading elements for titles, proper structure

## Initial Focus Placement

The most appropriate initial focus depends on dialog content:

| Content Type | Initial Focus |
|-------------|---------------|
| Simple dialog with buttons | First focusable element (button) |
| Complex content (lists, tables) | Title or first paragraph (`tabindex="-1"`) |
| Large content (may scroll) | Title or top element (`tabindex="-1"`) |
| Destructive action | Least destructive button |
| Information/confirmation | Most frequently used button |

## Accessibility Considerations

- Screen readers announce the dialog title and description when opened
- Focus is automatically moved to the dialog when it opens
- Focus is trapped within the dialog until it's closed
- Escape key provides a quick way to dismiss
- Focus returns to the trigger element when dialog closes
- Modal backdrop prevents interaction with page content
- `aria-modal="true"` informs assistive technologies that content outside is inert

## Differences from Alert Dialog

| Feature | Modal Dialog | Alert Dialog |
|---------|--------------|--------------|
| Role | `dialog` | `alertdialog` |
| Use case | General-purpose dialogs | Critical alerts requiring response |
| System alert sound | No | May trigger |
| Focus placement | Flexible | Usually first action button |
| aria-describedby | Optional | Required |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<dialog>` since v37) |
| Firefox | Full support (native `<dialog>` since v98) |
| Safari | Full support (native `<dialog>` since v15.4) |
| Edge | Full support (native `<dialog>` since v79) |

**Note**: Native `<dialog>` element has excellent support in modern browsers. For older browsers, use the custom implementation with proper ARIA attributes and focus trapping.

## References

- Source: [W3C ARIA Authoring Practices Guide - Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Related: [Alert Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
- MDN: [ARIA dialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/dialog_role)
- MDN: [HTML dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
