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

**File Structure:**

```
dialog/
  dialog.css.ts       # Styles (createStyles) - ALWAYS separate
  dialog.stories.tsx  # FT/bElement + stories (imports from css.ts)
```

#### dialog.css.ts

```typescript
// dialog.css.ts
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
    maxInlineSize: '600px',
    inlineSize: '90%',
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
  buttonPrimary: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
  },
})
```

#### dialog.stories.tsx

```typescript
// dialog.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './dialog.css.ts'

// ModalDialog bElement - defined locally, NOT exported
const ModalDialog = bElement({
  tag: 'pattern-modal-dialog',
  observedAttributes: ['open'],
  hostStyles,
  shadowDom: (
    <div
      p-target="overlay"
      {...styles.overlay}
      {...styles.overlayHidden}
      p-trigger={{ click: 'handleOverlayClick', keydown: 'handleKeydown' }}
    >
      <div
        p-target="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        {...styles.dialog}
        p-trigger={{ click: 'handleDialogClick' }}
      >
        <h2
          p-target="title"
          id="dialog-title"
          {...styles.title}
        >
          <slot name="title">Dialog Title</slot>
        </h2>
        <div
          p-target="content"
          id="dialog-description"
          {...styles.content}
        >
          <slot name="content"></slot>
        </div>
        <div {...styles.footer}>
          <slot name="footer">
            <button
              type="button"
              p-target="close-button"
              p-trigger={{ click: 'close' }}
              {...styles.button}
            >
              Close
            </button>
          </slot>
        </div>
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const overlay = $('overlay')[0]
    const dialog = $('dialog')[0]
    const title = $('title')[0]

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
        if (activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        if (activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    const openDialog = () => {
      previousActiveElement = document.activeElement as HTMLElement

      overlay?.attr('class', styles.overlay.classNames.join(' '))
      host.setAttribute('open', '')
      dialog?.attr('aria-modal', 'true')

      focusableElements = getFocusableElements()

      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      } else if (title) {
        title.setAttribute('tabindex', '-1')
        title.focus()
      }

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
      overlay?.attr('class', `${styles.overlay.classNames.join(' ')} ${styles.overlayHidden.classNames.join(' ')}`)
      host.removeAttribute('open')

      if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler)
        escapeHandler = undefined
      }

      previousActiveElement?.focus()
      previousActiveElement = null

      emit({ type: 'close' })
    }

    return {
      close() {
        closeDialog()
      },
      handleOverlayClick(event: MouseEvent) {
        if (event.target === overlay) {
          closeDialog()
        }
      },
      handleDialogClick(event: MouseEvent) {
        event.stopPropagation()
      },
      handleKeydown(event: KeyboardEvent) {
        trapFocus(event)
      },
      onConnected() {
        dialog?.attr('aria-labelledby', 'dialog-title')
        dialog?.attr('aria-describedby', 'dialog-description')
      },
      onDisconnected() {
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

// NativeDialog bElement using <dialog> element - defined locally, NOT exported
const NativeDialog = bElement({
  tag: 'pattern-native-dialog',
  observedAttributes: ['open'],
  hostStyles,
  shadowDom: (
    <dialog
      p-target="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      {...styles.dialog}
    >
      <h2 p-target="title" id="dialog-title" {...styles.title}>
        <slot name="title">Dialog Title</slot>
      </h2>
      <div p-target="content" id="dialog-description" {...styles.content}>
        <slot name="content"></slot>
      </div>
      <div {...styles.footer}>
        <slot name="footer">
          <button
            type="button"
            p-target="close-button"
            p-trigger={{ click: 'close' }}
            {...styles.button}
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
        dialog?.addEventListener('close', () => {
          host.removeAttribute('open')
          previousActiveElement?.focus()
          previousActiveElement = null
          emit({ type: 'close' })
        })
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

// DialogTrigger FunctionalTemplate - defined locally, NOT exported
const DialogTrigger: FT<{
  dialogId: string
  children?: Children
}> = ({ dialogId, children, ...attrs }) => (
  <button
    type="button"
    aria-haspopup="dialog"
    aria-controls={dialogId}
    {...attrs}
    {...styles.button}
    {...styles.buttonPrimary}
  >
    {children}
  </button>
)

// Stories - EXPORTED for testing/training
export const basicDialog = story({
  intent: 'Display a basic modal dialog with custom content',
  template: () => (
    <ModalDialog>
      <span slot="title">Confirm Action</span>
      <div slot="content">
        <p>Are you sure you want to proceed with this action?</p>
      </div>
      <div slot="footer">
        <button type="button" {...styles.button}>Cancel</button>
        <button type="button" {...styles.button} {...styles.buttonPrimary}>Confirm</button>
      </div>
    </ModalDialog>
  ),
  play: async ({ findByAttribute, assert }) => {
    const dialog = await findByAttribute('role', 'dialog')

    assert({
      given: 'modal dialog is rendered',
      should: 'have dialog role',
      actual: dialog?.getAttribute('role'),
      expected: 'dialog',
    })
  },
})

export const nativeDialog = story({
  intent: 'Display a dialog using native HTML dialog element',
  template: () => (
    <NativeDialog>
      <span slot="title">Native Dialog</span>
      <div slot="content">
        <p>This dialog uses the native HTML dialog element.</p>
      </div>
    </NativeDialog>
  ),
  play: async ({ findByAttribute, assert }) => {
    const dialog = await findByAttribute('role', 'dialog')

    assert({
      given: 'native dialog is rendered',
      should: 'have aria-modal true',
      actual: dialog?.getAttribute('aria-modal'),
      expected: 'true',
    })
  },
})

export const formDialog = story({
  intent: 'Display a dialog with form content',
  template: () => (
    <ModalDialog>
      <span slot="title">Sign In</span>
      <div slot="content">
        <form>
          <div style={{ marginBlockEnd: '1rem' }}>
            <label for="email" style={{ display: 'block', marginBlockEnd: '0.25rem' }}>Email</label>
            <input type="email" id="email" style={{ inlineSize: '100%', padding: '0.5rem' }} />
          </div>
          <div style={{ marginBlockEnd: '1rem' }}>
            <label for="password" style={{ display: 'block', marginBlockEnd: '0.25rem' }}>Password</label>
            <input type="password" id="password" style={{ inlineSize: '100%', padding: '0.5rem' }} />
          </div>
        </form>
      </div>
      <div slot="footer">
        <button type="button" {...styles.button}>Cancel</button>
        <button type="submit" {...styles.button} {...styles.buttonPrimary}>Sign In</button>
      </div>
    </ModalDialog>
  ),
  play: async ({ findByAttribute, assert }) => {
    const dialog = await findByAttribute('role', 'dialog')

    assert({
      given: 'form dialog is rendered',
      should: 'have aria-labelledby',
      actual: dialog?.getAttribute('aria-labelledby'),
      expected: 'dialog-title',
    })
  },
})

export const accessibilityTest = story({
  intent: 'Verify dialog accessibility requirements',
  template: () => (
    <ModalDialog>
      <span slot="title">Accessibility Test</span>
      <div slot="content">
        <p>Testing dialog accessibility.</p>
      </div>
    </ModalDialog>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - dialogs are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: Native `<dialog>` element (optional), focus management APIs
- **Cleanup required**: Yes - remove event listeners in `onDisconnected`

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
6. **Use spread syntax** - `{...styles.x}` for applying styles
7. **Provide close button** - Include a visible close button in the dialog
8. **Handle overlay clicks** - Optionally close when clicking outside dialog
9. **Clean up event listeners** - Remove keyboard handlers when dialog closes
10. **Use `$()` with `p-target`** - never use `querySelector` directly

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

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<dialog>` since v37) |
| Firefox | Full support (native `<dialog>` since v98) |
| Safari | Full support (native `<dialog>` since v15.4) |
| Edge | Full support (native `<dialog>` since v79) |

## References

- Source: [W3C ARIA Authoring Practices Guide - Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Related: [Alert Dialog Pattern](./aria-alertdialog-pattern.md)
- MDN: [ARIA dialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/dialog_role)
- MDN: [HTML dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
