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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

  function closeDialog() {
    dialog.hidden = true
    document.removeEventListener('keydown', handleEscape)
    // Return focus to trigger element
  }
}
```

### Plaited Adaptation

**Native HTML First:** Consider using the native `<dialog>` element which provides built-in focus trapping, backdrop, and Escape key handling.

**File Structure:**

```
alert-dialog/
  alert-dialog.css.ts        # Styles (createStyles) - ALWAYS separate
  alert-dialog.stories.tsx   # bElement + stories (imports from css.ts)
```

#### alert-dialog.css.ts

```typescript
// alert-dialog.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    inlineSize: '100%',
    blockSize: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  overlayHidden: {
    display: 'none',
  },
  dialog: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    maxInlineSize: '400px',
    inlineSize: '90%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  nativeDialog: {
    padding: '1.5rem',
    borderRadius: '8px',
    border: 'none',
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
  confirmButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    borderColor: '#dc3545',
  },
})
```

#### alert-dialog.stories.tsx

```typescript
// alert-dialog.stories.tsx
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './alert-dialog.css.ts'

// bElement using native <dialog> - defined locally, NOT exported
const AlertDialog = bElement({
  tag: 'pattern-alert-dialog',
  observedAttributes: ['open'],
  hostStyles,
  shadowDom: (
    <dialog
      p-target="dialog"
      role="alertdialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
      {...styles.nativeDialog}
    >
      <h2 p-target="title" id="dialog-title" {...styles.title}>
        <slot name="title">Confirm Action</slot>
      </h2>
      <p p-target="message" id="dialog-message" {...styles.message}>
        <slot name="message">Are you sure?</slot>
      </p>
      <div {...styles.buttonGroup}>
        <button
          type="button"
          p-target="cancel-button"
          p-trigger={{ click: 'cancel' }}
          {...styles.button}
        >
          <slot name="cancel-label">Cancel</slot>
        </button>
        <button
          type="button"
          p-target="confirm-button"
          p-trigger={{ click: 'confirm' }}
          {...styles.button}
          {...styles.confirmButton}
        >
          <slot name="confirm-label">Confirm</slot>
        </button>
      </div>
    </dialog>
  ),
  bProgram({ $, host, emit }) {
    const dialog = $<HTMLDialogElement>('dialog')[0]
    let previousActiveElement: HTMLElement | null = null

    const openDialog = () => {
      previousActiveElement = document.activeElement as HTMLElement
      dialog?.root.showModal()
      host.setAttribute('open', '')
    }

    const closeDialog = () => {
      dialog?.root.close()
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
        // Handle native dialog close (Escape key, clicking backdrop)
        const dialogElement = dialog?.root as HTMLDialogElement
        dialogElement?.addEventListener('close', () => {
          host.removeAttribute('open')
          previousActiveElement?.focus()
          previousActiveElement = null
          emit({ type: 'cancel' })
        })
      },
    }
  },
})

// Custom implementation without native dialog - defined locally, NOT exported
const CustomAlertDialog = bElement({
  tag: 'pattern-custom-alert-dialog',
  observedAttributes: ['open'],
  hostStyles,
  shadowDom: (
    <div p-target="overlay" {...styles.overlay} {...styles.overlayHidden}>
      <div
        p-target="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        {...styles.dialog}
      >
        <h2 p-target="title" id="dialog-title" {...styles.title}>
          <slot name="title">Confirm Action</slot>
        </h2>
        <p p-target="message" id="dialog-message" {...styles.message}>
          <slot name="message">Are you sure?</slot>
        </p>
        <div {...styles.buttonGroup}>
          <button
            type="button"
            p-target="cancel-button"
            p-trigger={{ click: 'cancel' }}
            {...styles.button}
          >
            <slot name="cancel-label">Cancel</slot>
          </button>
          <button
            type="button"
            p-target="confirm-button"
            p-trigger={{ click: 'confirm' }}
            {...styles.button}
            {...styles.confirmButton}
          >
            <slot name="confirm-label">Confirm</slot>
          </button>
        </div>
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const overlay = $('overlay')[0]
    const confirmButton = $<HTMLButtonElement>('confirm-button')[0]
    let previousActiveElement: HTMLElement | null = null
    let escapeHandler: ((e: KeyboardEvent) => void) | undefined

    const openDialog = () => {
      previousActiveElement = document.activeElement as HTMLElement

      // Show overlay
      overlay?.attr('class', styles.overlay.classNames.join(' '))
      host.setAttribute('open', '')

      // Focus first actionable element
      confirmButton?.root.focus()

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
      // Hide overlay
      overlay?.attr('class', `${styles.overlay.classNames.join(' ')} ${styles.overlayHidden.classNames.join(' ')}`)
      host.removeAttribute('open')

      // Remove escape handler
      if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler)
        escapeHandler = undefined
      }

      // Return focus
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
      onDisconnected() {
        // Cleanup escape handler
        if (escapeHandler) {
          document.removeEventListener('keydown', escapeHandler)
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const nativeAlertDialog = story({
  intent: 'Alert dialog using native <dialog> element with built-in focus trapping',
  template: () => (
    <div>
      <button
        type="button"
        p-target="trigger"
        p-trigger={{ click: 'openDialog' }}
      >
        Delete Item
      </button>
      <AlertDialog p-target="dialog" p-trigger={{ confirm: 'handleConfirm', cancel: 'handleCancel' }}>
        <span slot="title">Delete Item</span>
        <span slot="message">Are you sure you want to delete this item? This action cannot be undone.</span>
        <span slot="cancel-label">Cancel</span>
        <span slot="confirm-label">Delete</span>
      </AlertDialog>
    </div>
  ),
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const trigger = await findByAttribute('p-target', 'trigger')
    const dialog = await findByAttribute('p-target', 'dialog')

    assert({
      given: 'alert dialog is rendered',
      should: 'not have open attribute initially',
      actual: dialog?.hasAttribute('open'),
      expected: false,
    })

    if (trigger) await fireEvent(trigger, 'click')

    // Dialog should now be open
    assert({
      given: 'trigger is clicked',
      should: 'open the dialog',
      actual: dialog?.hasAttribute('open'),
      expected: true,
    })
  },
})

export const customAlertDialog = story({
  intent: 'Alert dialog with custom overlay implementation for full control',
  template: () => (
    <div>
      <button
        type="button"
        p-target="trigger"
        p-trigger={{ click: 'openDialog' }}
      >
        Confirm Action
      </button>
      <CustomAlertDialog p-target="dialog" p-trigger={{ confirm: 'handleConfirm', cancel: 'handleCancel' }}>
        <span slot="title">Confirm Action</span>
        <span slot="message">Are you sure you want to proceed?</span>
      </CustomAlertDialog>
    </div>
  ),
  play: async ({ findByAttribute, assert }) => {
    const dialog = await findByAttribute('p-target', 'dialog')

    assert({
      given: 'custom alert dialog is rendered',
      should: 'have alertdialog role on inner element',
      actual: dialog?.shadowRoot?.querySelector('[role="alertdialog"]') !== null,
      expected: true,
    })
  },
})

export const deleteConfirmation = story({
  intent: 'Destructive action confirmation with clear labeling',
  template: () => (
    <AlertDialog open>
      <span slot="title">Delete Account</span>
      <span slot="message">This will permanently delete your account and all associated data. This action cannot be undone.</span>
      <span slot="cancel-label">Keep Account</span>
      <span slot="confirm-label">Delete Forever</span>
    </AlertDialog>
  ),
  play: async ({ findByAttribute, assert, accessibilityCheck }) => {
    const confirmButton = await findByAttribute('p-target', 'confirm-button')

    assert({
      given: 'delete confirmation is shown',
      should: 'have confirm button with destructive styling',
      actual: confirmButton !== null,
      expected: true,
    })

    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - alert dialogs are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: Native `<dialog>` element (recommended), focus management APIs
- **Cleanup required**: Yes - remove keyboard event listeners in `onDisconnected`

## Keyboard Interaction

Follows the Modal Dialog Pattern keyboard interaction:

- **Tab**: Moves focus to the next focusable element within the dialog
- **Shift + Tab**: Moves focus to the previous focusable element within the dialog
- **Escape**: Closes the dialog and returns focus to the trigger element
- **Focus trapping**: Focus is trapped within the dialog when open

**Note**: Native `<button>` elements handle Enter and Space automatically. Native `<dialog>` element handles focus trapping and Escape key automatically.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="alertdialog"**: Identifies the element as an alert dialog
- **aria-labelledby**: ID reference to the element containing the dialog title
- **aria-describedby**: ID reference to the element containing the alert message
- **aria-modal**: Set to `"true"` to indicate the dialog is modal

### Optional

- **aria-label**: Alternative to `aria-labelledby` if the dialog doesn't have a visible title

## Best Practices

1. **Use native `<dialog>` element** - provides built-in focus trapping and Escape handling
2. **Store previous focus** - always return focus to the element that triggered the dialog
3. **Use static `p-trigger`** in templates - never add event handlers dynamically
4. **Use `$()` with `p-target`** - never use `querySelector` directly
5. **Clean up event listeners** - remove keyboard handlers in `onDisconnected`
6. **Provide clear actions** - use descriptive button labels (e.g., "Delete" not "OK")

## Accessibility Considerations

- Screen readers announce the dialog title and message when opened
- Focus is automatically moved to the dialog when it opens
- Focus is trapped within the dialog until it's closed
- Escape key provides a quick way to dismiss
- Focus returns to the trigger element when dialog closes
- Modal backdrop prevents interaction with page content

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

## References

- Source: [W3C ARIA Authoring Practices Guide - Alert Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
- Related: [Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- MDN: [ARIA alertdialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/alertdialog_role)
- MDN: [HTML dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
