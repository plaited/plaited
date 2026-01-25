# ARIA Alert Pattern

## Overview

An alert is an element that displays a brief, important message in a way that attracts the user's attention without interrupting the user's task. Dynamically rendered alerts are automatically announced by most screen readers, and in some operating systems. Alerts may trigger an alert sound.

**Critical Design Considerations:**

- Alerts should **NOT** affect keyboard focus
- Alerts should **NOT** disappear automatically (violates WCAG 2.2.3)
- Avoid frequent interruptions (violates WCAG 2.2.4)
- Screen readers do not announce alerts present before page load completes
- Use Alert Dialog Pattern for situations requiring workflow interruption

## Use Cases

- Form validation errors
- Success confirmations after actions
- System status updates
- Important notifications that don't require immediate action
- Warning messages
- Information updates

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Static alert -->
<div role="alert">
  Your changes have been saved.
</div>

<!-- Dynamic alert (announced by screen readers) -->
<div id="alert-container" role="alert" aria-live="assertive">
  <!-- Alerts dynamically inserted here -->
</div>
```

```javascript
// Dynamically render alert
function showAlert(message, type = 'info') {
  const container = document.getElementById('alert-container')
  const alert = document.createElement('div')
  alert.setAttribute('role', 'alert')
  alert.textContent = message
  alert.className = `alert alert-${type}`

  // Clear existing alerts if needed
  container.innerHTML = ''
  container.appendChild(alert)

  // Screen reader will automatically announce
  // Do NOT focus the alert
}

// Remove alert (user-initiated, not automatic)
function dismissAlert(alertElement) {
  alertElement.remove()
}
```

### Plaited Adaptation

**File Structure:**

```
alert/
  alert.css.ts        # Styles (createStyles) - ALWAYS separate
  alert.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### alert.css.ts

```typescript
// alert.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  alert: {
    padding: '1rem',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBlockEnd: '0.5rem',
  },
  info: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    color: '#1565c0',
  },
  success: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
    color: '#2e7d32',
  },
  warning: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    color: '#e65100',
  },
  error: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    color: '#c62828',
  },
  dismissButton: {
    marginInlineStart: '1rem',
    padding: '0.25rem 0.5rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  container: {
    position: 'fixed',
    insetBlockStart: '1rem',
    insetInlineEnd: '1rem',
    maxInlineSize: '400px',
    zIndex: 1000,
  },
})
```

#### alert.stories.tsx

```typescript
// alert.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './alert.css.ts'

// FunctionalTemplate - defined locally, NOT exported
const Alert: FT<{
  variant?: 'info' | 'success' | 'warning' | 'error'
  children?: Children
}> = ({ variant = 'info', children, ...attrs }) => (
  <div
    role="alert"
    {...attrs}
    {...styles.alert}
    {...styles[variant]}
  >
    {children}
  </div>
)

// bElement for dismissible alerts - defined locally, NOT exported
const DismissibleAlert = bElement({
  tag: 'pattern-dismissible-alert',
  observedAttributes: ['variant'],
  shadowDom: (
    <div
      p-target="alert"
      role="alert"
      {...styles.alert}
      {...styles.info}
    >
      <slot></slot>
      <button
        type="button"
        p-target="dismiss-button"
        p-trigger={{ click: 'dismiss' }}
        aria-label="Dismiss alert"
        {...styles.dismissButton}
      >
        ×
      </button>
    </div>
  ),
  bProgram({ $, emit, host }) {
    const alert = $('alert')[0]

    return {
      dismiss() {
        emit({ type: 'dismiss' })
        host.remove()
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'variant' && newValue) {
          // Update variant styling
          const validVariants = ['info', 'success', 'warning', 'error'] as const
          if (validVariants.includes(newValue as typeof validVariants[number])) {
            // Apply new variant class
          }
        }
      },
    }
  },
})

// bElement for alert container - defined locally, NOT exported
const AlertContainer = bElement({
  tag: 'pattern-alert-container',
  shadowDom: (
    <div
      p-target="container"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      {...styles.container}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $ }) {
    const container = $('container')[0]

    return {
      showAlert({ message, variant = 'info' }: { message: string; variant?: string }) {
        if (!container) return

        const alertId = `alert-${Date.now()}`
        container.insert(
          'afterbegin',
          <div
            p-target={alertId}
            role="alert"
            data-variant={variant}
            {...styles.alert}
            {...styles[variant as keyof typeof styles]}
          >
            <span>{message}</span>
            <button
              type="button"
              p-trigger={{ click: 'dismissAlert' }}
              data-alert-id={alertId}
              aria-label="Dismiss alert"
              {...styles.dismissButton}
            >
              ×
            </button>
          </div>
        )
      },
      dismissAlert(event: { target: HTMLButtonElement }) {
        const alertId = event.target.getAttribute('data-alert-id')
        if (!alertId) return

        const alertElement = $(alertId)[0]
        alertElement?.root.remove()
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const infoAlert = story({
  intent: 'Display an informational alert message that does not interrupt workflow',
  template: () => (
    <Alert variant="info">
      Your changes have been saved successfully.
    </Alert>
  ),
  play: async ({ findByAttribute, assert, accessibilityCheck }) => {
    const alert = await findByAttribute('role', 'alert')

    assert({
      given: 'info alert is rendered',
      should: 'have role="alert"',
      actual: alert?.getAttribute('role'),
      expected: 'alert',
    })

    await accessibilityCheck({})
  },
})

export const successAlert = story({
  intent: 'Display a success alert for completed actions',
  template: () => (
    <Alert variant="success">
      File uploaded successfully!
    </Alert>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const warningAlert = story({
  intent: 'Display a warning alert for cautionary messages',
  template: () => (
    <Alert variant="warning">
      Your session will expire in 5 minutes.
    </Alert>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const errorAlert = story({
  intent: 'Display an error alert for validation or system errors',
  template: () => (
    <Alert variant="error">
      Failed to save changes. Please try again.
    </Alert>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const dismissibleAlert = story({
  intent: 'Display an alert with user-controlled dismiss button',
  template: () => (
    <DismissibleAlert variant="info">
      This alert can be dismissed by clicking the X button.
    </DismissibleAlert>
  ),
  play: async ({ findByAttribute, assert }) => {
    const dismissButton = await findByAttribute('p-target', 'dismiss-button')

    assert({
      given: 'dismissible alert is rendered',
      should: 'have a dismiss button',
      actual: dismissButton !== null,
      expected: true,
    })

    assert({
      given: 'dismiss button exists',
      should: 'have accessible label',
      actual: dismissButton?.getAttribute('aria-label'),
      expected: 'Dismiss alert',
    })
  },
})

export const alertContainer = story({
  intent: 'Container for dynamically added alerts using aria-live region',
  template: () => (
    <AlertContainer>
      <Alert variant="info">Initial alert in container.</Alert>
    </AlertContainer>
  ),
  play: async ({ findByAttribute, assert }) => {
    const container = await findByAttribute('p-target', 'container')

    assert({
      given: 'alert container is rendered',
      should: 'have aria-live="assertive"',
      actual: container?.getAttribute('aria-live'),
      expected: 'assertive',
    })
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - alert containers are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `insert`, `attr`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

**Not applicable** - Alerts do not receive keyboard focus and do not have interactive elements beyond optional dismiss buttons. Dismiss buttons follow standard button keyboard interaction (Enter/Space to activate).

## WAI-ARIA Roles, States, and Properties

### Required

- **role="alert"**: Identifies the element as an alert, causing screen readers to announce it when dynamically rendered

### Optional

- **aria-live**: Set to `"assertive"` for immediate announcements. This is the default behavior for role="alert".
- **aria-atomic**: Set to `"true"` to announce entire region, `"false"` to announce only changes
- **aria-label**: On dismiss buttons for accessible labeling

## Best Practices

1. **Do NOT move focus** - Alerts should not steal keyboard focus from the user's current task
2. **Do NOT auto-dismiss** - Alerts that disappear automatically violate WCAG 2.2.3 (No Timing)
3. **Provide dismiss controls** - Allow users to manually dismiss alerts when appropriate
4. **Use appropriate variants** - Distinguish between info, success, warning, and error visually
5. **Limit frequency** - Avoid showing multiple alerts rapidly (violates WCAG 2.2.4)
6. **Use role="alert" sparingly** - Only for truly important messages that need immediate attention
7. **Use static `p-trigger`** in templates - never add event handlers dynamically
8. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers automatically announce dynamically rendered alerts with `role="alert"`
- Alerts present before page load are NOT announced by screen readers
- Visual styling should clearly distinguish alert types (info, success, warning, error)
- Dismiss buttons must be keyboard accessible
- Alerts should not interrupt user workflow - use Alert Dialog Pattern for interruptions
- Consider using `aria-live="polite"` for less urgent status updates

## WCAG Compliance

- **2.2.3 No Timing (Level AAA)**: Alerts must not disappear automatically
- **2.2.4 Interruptions (Level AAA)**: Avoid frequent alert interruptions
- **4.1.3 Status Messages (Level AA)**: Alerts must be programmatically determinable

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
- MDN: [ARIA alert role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/alert_role)
- MDN: [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- WCAG: [2.2.3 No Timing](https://www.w3.org/WAI/WCAG21/Understanding/no-timing.html)
- WCAG: [2.2.4 Interruptions](https://www.w3.org/WAI/WCAG21/Understanding/interruptions.html)
