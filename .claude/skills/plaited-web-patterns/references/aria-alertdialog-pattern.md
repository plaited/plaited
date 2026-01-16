# ARIA Alert Dialog Pattern

## Overview

An alert dialog is a modal dialog that interrupts the user's workflow to communicate an important message and acquire a response. Examples include action confirmation prompts and error message confirmations. The `alertdialog` role enables assistive technologies and browsers to distinguish alert dialogs from other dialogs so they have the option of giving alert dialogs special treatment, such as playing a system alert sound.

**Key Differences from Alert Pattern:**

- Alert dialogs **DO** interrupt workflow and require user response
- Alert dialogs **DO** manage keyboard focus (traps focus within dialog)
- Alert dialogs are **modal** (blocks interaction with page content)
- Alert dialogs use `role="alertdialog"` instead of `role="alert"`

## Use Cases

- Action confirmation prompts ("Are you sure you want to delete?")
- Error message confirmations requiring acknowledgment
- Critical system notifications requiring user response
- Unsaved changes warnings
- Permission requests
- Critical validation errors that block form submission

## Implementation

### Vanilla JavaScript

```html
<div 
  role="alertdialog"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-message"
  aria-modal="true"
>
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-message">Are you sure you want to delete this item?</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

```javascript
// Show alert dialog
function showAlertDialog(title, message, onConfirm, onCancel) {
  const dialog = document.getElementById('alert-dialog')
  const titleEl = document.getElementById('dialog-title')
  const messageEl = document.getElementById('dialog-message')
  
  titleEl.textContent = title
  messageEl.textContent = message
  
  dialog.setAttribute('aria-labelledby', 'dialog-title')
  dialog.setAttribute('aria-describedby', 'dialog-message')
  dialog.setAttribute('aria-modal', 'true')
  dialog.hidden = false
  
  // Trap focus within dialog
  const firstFocusable = dialog.querySelector('button')
  firstFocusable?.focus()
  
  // Handle escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeDialog()
    }
  }
  document.addEventListener('keydown', handleEscape)
  
  // Handle button clicks
  dialog.querySelector('[data-action="confirm"]').onclick = () => {
    closeDialog()
    onConfirm?.()
  }
  dialog.querySelector('[data-action="cancel"]').onclick = () => {
    closeDialog()
    onCancel?.()
  }
  
  function closeDialog() {
    dialog.hidden = true
    document.removeEventListener('keydown', handleEscape)
    // Return focus to trigger element
  }
}
```

### Plaited Adaptation

**Important**: In Plaited, alert dialogs are implemented as **bElements** because they require:

- Complex state management (open/closed)
- Focus trapping
- Keyboard event handling (Escape key)
- Modal overlay management
- Return focus to trigger element

#### Alert Dialog bElement

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
    maxInlineSize: '400px',
    inlineSize: '90%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  title: {
    marginBlockEnd: '1rem',
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  message: {
    marginBlockEnd: '1.5rem',
  },
  buttonGroup: {
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

type AlertDialogEvents = {
  confirm: undefined
  cancel: undefined
  close: undefined
}

export const AlertDialog = bElement<AlertDialogEvents>({
  tag: 'alert-dialog',
  observedAttributes: ['open'],
  hostStyles: dialogHostStyles,
  shadowDom: (
    <div
      p-target='overlay'
      {...dialogStyles.overlay}
      data-open='false'
    >
      <div
        p-target='dialog'
        role='alertdialog'
        aria-modal='true'
        {...dialogStyles.dialog}
      >
        <h2
          p-target='title'
          id='dialog-title'
          {...dialogStyles.title}
        >
          <slot name='title'>Confirm Action</slot>
        </h2>
        <p
          p-target='message'
          id='dialog-message'
          {...dialogStyles.message}
        >
          <slot name='message'>Are you sure?</slot>
        </p>
        <div {...dialogStyles.buttonGroup}>
          <button
            type='button'
            p-target='cancel-button'
            p-trigger={{ click: 'cancel', keydown: 'handleKeydown' }}
            {...dialogStyles.button}
          >
            <slot name='cancel-label'>Cancel</slot>
          </button>
          <button
            type='button'
            p-target='confirm-button'
            p-trigger={{ click: 'confirm', keydown: 'handleKeydown' }}
            {...dialogStyles.button}
          >
            <slot name='confirm-label'>Confirm</slot>
          </button>
        </div>
      </div>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const overlay = $('overlay')[0]
    const dialog = $('dialog')[0]
    const title = $('title')[0]
    const message = $('message')[0]
    const cancelButton = $<HTMLButtonElement>('cancel-button')[0]
    const confirmButton = $<HTMLButtonElement>('confirm-button')[0]
    
    let previousActiveElement: HTMLElement | null = null
    let escapeHandler: ((e: KeyboardEvent) => void) | undefined

    const openDialog = () => {
      // Store element that had focus before opening
      previousActiveElement = document.activeElement as HTMLElement
      
      // Show dialog
      overlay?.attr('data-open', 'true')
      host.setAttribute('open', '')
      
      // Set ARIA attributes
      dialog?.attr('aria-labelledby', 'dialog-title')
      dialog?.attr('aria-describedby', 'dialog-message')
      dialog?.attr('aria-modal', 'true')
      
      // Trap focus - focus first button
      confirmButton?.focus()
      
      // Handle Escape key
      escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeDialog()
          emit({ type: 'cancel' })
        }
      }
      document.addEventListener('keydown', escapeHandler)
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
    }

    return {
      confirm() {
        closeDialog()
        emit({ type: 'confirm' })
      },
      cancel() {
        closeDialog()
        emit({ type: 'cancel' })
      },
      handleKeydown(event: KeyboardEvent) {
        // Tab trapping - keep focus within dialog
        if (event.key === 'Tab') {
          const focusableElements = [
            cancelButton,
            confirmButton,
          ].filter((el) => el !== null) as HTMLElement[]
          
          const firstElement = focusableElements[0]
          const lastElement = focusableElements[focusableElements.length - 1]
          
          if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
              event.preventDefault()
              lastElement.focus()
            }
          } else {
            // Tab
            if (document.activeElement === lastElement) {
              event.preventDefault()
              firstElement.focus()
            }
          }
        }
      },
      onConnected() {
        // Initialize ARIA attributes
        if (title) {
          dialog?.attr('aria-labelledby', 'dialog-title')
        }
        if (message) {
          dialog?.attr('aria-describedby', 'dialog-message')
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
    maxInlineSize: '400px',
    inlineSize: '90%',
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
  message: {
    marginBlockEnd: '1.5rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
  },
})

type AlertDialogEvents = {
  confirm: undefined
  cancel: undefined
}

export const NativeAlertDialog = bElement<AlertDialogEvents>({
  tag: 'native-alert-dialog',
  observedAttributes: ['open'],
  shadowDom: (
    <dialog
      p-target='dialog'
      role='alertdialog'
      aria-labelledby='dialog-title'
      aria-describedby='dialog-message'
      {...dialogStyles.dialog}
    >
      <h2
        p-target='title'
        id='dialog-title'
        {...dialogStyles.title}
      >
        <slot name='title'>Confirm Action</slot>
      </h2>
      <p
        p-target='message'
        id='dialog-message'
        {...dialogStyles.message}
      >
        <slot name='message'>Are you sure?</slot>
      </p>
      <div {...dialogStyles.buttonGroup}>
        <button
          type='button'
          p-target='cancel-button'
          p-trigger={{ click: 'cancel' }}
        >
          <slot name='cancel-label'>Cancel</slot>
        </button>
        <button
          type='button'
          p-target='confirm-button'
          p-trigger={{ click: 'confirm' }}
        >
          <slot name='confirm-label'>Confirm</slot>
        </button>
      </div>
    </dialog>
  ),
  bProgram({ $, host, emit, root }) {
    const dialog = $<HTMLDialogElement>('dialog')[0]
    let previousActiveElement: HTMLElement | null = null

    const openDialog = () => {
      previousActiveElement = document.activeElement as HTMLElement
      dialog?.showModal()
      host.setAttribute('open', '')
    }

    const closeDialog = () => {
      dialog?.close()
      host.removeAttribute('open')
      previousActiveElement?.focus()
      previousActiveElement = null
    }

    return {
      confirm() {
        closeDialog()
        emit({ type: 'confirm' })
      },
      cancel() {
        closeDialog()
        emit({ type: 'cancel' })
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
      onConnected() {
        // Handle native dialog close (e.g., clicking backdrop or pressing Escape)
        dialog?.addEventListener('close', () => {
          host.removeAttribute('open')
          previousActiveElement?.focus()
          previousActiveElement = null
          emit({ type: 'cancel' })
        })
      },
    }
  },
})
```

#### Usage Example

```typescript
// In a story or template
<button
  p-trigger={{ click: 'showDeleteDialog' }}
>
  Delete Item
</button>

<AlertDialog
  p-target='delete-dialog'
  p-trigger={{ confirm: 'handleDelete', cancel: 'handleCancel' }}
>
  <span slot='title'>Delete Item</span>
  <span slot='message'>Are you sure you want to delete this item? This action cannot be undone.</span>
  <span slot='cancel-label'>Cancel</span>
  <span slot='confirm-label'>Delete</span>
</AlertDialog>

// In bProgram
bProgram({ $, trigger }) {
  const dialog = $('delete-dialog')[0]
  
  return {
    showDeleteDialog() {
      dialog?.attr('open', '')
    },
    handleDelete() {
      // Perform delete action
      console.log('Item deleted')
    },
    handleCancel() {
      // Dialog already closed, just handle any cleanup
    },
  }
}
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - alert dialogs are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for button clicks and keyboard events
  - `p-target` for element selection with `$()`
  - `attr()` helper for managing dialog state and ARIA attributes
  - `observedAttributes` for reactive open/close state
  - Native `<dialog>` element support (optional)
- **Requires external web API**: 
  - Native `<dialog>` element (if using native implementation)
  - Focus management APIs (focus(), activeElement)
  - Keyboard event handling
- **Cleanup required**: Yes - remove event listeners in `onDisconnected` if using custom implementation

## Keyboard Interaction

Follows the [Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) keyboard interaction:

- **Tab**: Moves focus to the next focusable element within the dialog
- **Shift + Tab**: Moves focus to the previous focusable element within the dialog
- **Escape**: Closes the dialog and returns focus to the trigger element
- **Focus trapping**: Focus is trapped within the dialog when open

**Note**: If using native `<dialog>` element, focus trapping and Escape key handling are handled automatically by the browser.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="alertdialog"**: Identifies the element as an alert dialog
- **aria-labelledby**: ID reference to the element containing the dialog title (or use `aria-label` if no visible title)
- **aria-describedby**: ID reference to the element containing the alert message
- **aria-modal**: Set to `"true"` to indicate the dialog is modal

### Optional

- **aria-label**: Alternative to `aria-labelledby` if the dialog doesn't have a visible title

## Best Practices

1. **Use bElement** - Alert dialogs require complex state management and focus trapping
2. **Consider native `<dialog>`** - Modern browsers provide built-in focus trapping and backdrop
3. **Store previous focus** - Always return focus to the element that triggered the dialog
4. **Trap focus** - Keep keyboard focus within the dialog when open
5. **Handle Escape key** - Allow users to close the dialog with Escape
6. **Provide clear actions** - Use descriptive button labels (e.g., "Delete" not "OK")
7. **Use semantic HTML** - Use heading elements for titles, paragraphs for messages
8. **Clean up event listeners** - Remove keyboard event listeners when dialog closes
9. **Support both aria-labelledby and aria-label** - Allow flexibility in dialog structure

## Accessibility Considerations

- Screen readers announce the dialog title and message when opened
- Focus is automatically moved to the dialog when it opens
- Focus is trapped within the dialog until it's closed
- Escape key provides a quick way to dismiss
- Focus returns to the trigger element when dialog closes
- Modal backdrop prevents interaction with page content
- Alert dialogs may trigger system alert sounds in some operating systems

## Differences from Alert Pattern

| Feature | Alert | Alert Dialog |
|---------|-------|--------------|
| Interrupts workflow | No | Yes |
| Manages focus | No | Yes |
| Modal | No | Yes |
| Requires response | No | Yes |
| Role | `alert` | `alertdialog` |
| Use case | Status updates | Critical confirmations |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<dialog>` since v37) |
| Firefox | Full support (native `<dialog>` since v98) |
| Safari | Full support (native `<dialog>` since v15.4) |
| Edge | Full support (native `<dialog>` since v79) |

**Note**: Native `<dialog>` element has excellent support in modern browsers. For older browsers, use the custom implementation with proper ARIA attributes.

## References

- Source: [W3C ARIA Authoring Practices Guide - Alert Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
- Related: [Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- MDN: [ARIA alertdialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/alertdialog_role)
- MDN: [HTML dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
