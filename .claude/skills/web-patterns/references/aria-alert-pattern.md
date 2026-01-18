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

**Important**: In Plaited, alerts can be implemented as either:

1. **Functional Templates (FT)** for static alerts in stories
2. **bElements** for dynamic alerts that need to be announced by screen readers

#### Static Alert (Functional Template)

```typescript
// alert.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { alertStyles } from './alert.css.ts'

const Alert: FT<{
  variant?: 'info' | 'success' | 'warning' | 'error'
  children?: Children
}> = ({ variant = 'info', children, ...attrs }) => (
  <div
    role='alert'
    {...attrs}
    {...joinStyles(alertStyles.alert, alertStyles[variant])}
  >
    {children}
  </div>
)

export const infoAlert = story({
  intent: 'Display an informational alert message',
  template: () => (
    <Alert variant='info'>
      Your changes have been saved successfully.
    </Alert>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

#### Dynamic Alert Container (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'
import { Alert } from './alert.stories.tsx'

const alertContainerStyles = createStyles({
  container: {
    position: 'fixed',
    insetBlockStart: '1rem',
    insetInlineEnd: '1rem',
    maxInlineSize: '400px',
    zIndex: 1000,
  },
  alert: {
    marginBlockEnd: '0.5rem',
    padding: '1rem',
    borderRadius: '4px',
    border: '1px solid',
  },
})

type AlertContainerEvents = {
  show: { message: string; variant?: 'info' | 'success' | 'warning' | 'error' }
  dismiss: { alertId: string }
}

export const AlertContainer = bElement<AlertContainerEvents>({
  tag: 'alert-container',
  shadowDom: (
    <div
      p-target='container'
      role='alert'
      aria-live='assertive'
      aria-atomic='true'
      {...alertContainerStyles.container}
    >
      {/* Alerts will be dynamically inserted here */}
    </div>
  ),
  bProgram({ $, root }) {
    const container = $('container')[0]
    let alertIdCounter = 0

    return {
      show({ message, variant = 'info' }) {
        if (!container) return

        const alertId = `alert-${alertIdCounter++}`
        const alertElement = (
          <div
            p-target={alertId}
            role='alert'
            data-variant={variant}
            {...alertContainerStyles.alert}
          >
            <span>{message}</span>
            <button
              type='button'
              p-trigger={{ click: 'dismissAlert' }}
              aria-label='Dismiss alert'
            >
              ×
            </button>
          </div>
        )

        // Insert new alert at the beginning
        container.insert('afterbegin', alertElement)

        // Screen reader will automatically announce due to role="alert"
        // Do NOT focus the alert
      },
      dismissAlert(event: { target: HTMLButtonElement }) {
        const button = event.target
        const alert = button.closest('[role="alert"]')
        if (alert && alert !== container) {
          alert.remove()
        }
      },
    }
  },
})
```

#### Alert with Auto-Dismiss (User-Controlled)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const alertStyles = createStyles({
  alert: {
    padding: '1rem',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBlockEnd: '0.5rem',
  },
  dismissButton: {
    marginInlineStart: '1rem',
    padding: '0.25rem 0.5rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
})

type AlertEvents = {
  dismiss: undefined
}

export const DismissibleAlert = bElement<AlertEvents>({
  tag: 'dismissible-alert',
  shadowDom: (
    <div
      p-target='alert'
      role='alert'
      {...alertStyles.alert}
    >
      <slot></slot>
      <button
        type='button'
        p-target='dismiss-button'
        p-trigger={{ click: 'dismiss' }}
        aria-label='Dismiss alert'
        {...alertStyles.dismissButton}
      >
        ×
      </button>
    </div>
  ),
  bProgram({ $, emit, host }) {
    const alert = $('alert')[0]

    return {
      handleKeydown(event: KeyboardEvent) {
        const alert = event.target as HTMLAlertElement
        if (!alert) return

        switch (event.key) {
          case 'Esc':
            event.preventDefault()
            dismiss()
            break
        }
      },
      dismiss() {
        emit({ type: 'dismiss' })
        // Parent can remove the element
        // Or hide it: alert?.attr('hidden', '')
      },
    }
  },
})
```

#### Alert Manager (Global Alert System)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'
import { useSignal } from 'plaited'

type Alert = {
  id: string
  message: string
  variant: 'info' | 'success' | 'warning' | 'error'
}

const alertManagerStyles = createStyles({
  container: {
    position: 'fixed',
    insetBlockStart: '1rem',
    insetInlineEnd: '1rem',
    maxInlineSize: '400px',
    zIndex: 1000,
  },
  alert: {
    padding: '1rem',
    marginBlockEnd: '0.5rem',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})

// Global signal for alert state
const alertSignal = useSignal<Alert[]>([])

export const AlertManager = bElement({
  tag: 'alert-manager',
  shadowDom: (
    <div
      p-target='container'
      role='alert'
      aria-live='assertive'
      aria-atomic='false'
      {...alertManagerStyles.container}
    >
      {/* Alerts rendered dynamically */}
    </div>
  ),
  bProgram({ $, trigger }) {
    const container = $('container')[0]

    // Subscribe to alert signal changes
    alertSignal.listen('alert-update', trigger, true)

    return {
      'alert-update'(alerts: Alert[]) {
        if (!container) return

        // Clear and re-render all alerts
        container.render(
          ...alerts.map((alert) => (
            <div
              key={alert.id}
              role='alert'
              data-variant={alert.variant}
              {...alertManagerStyles.alert}
            >
              <span>{alert.message}</span>
              <button
                type='button'
                p-trigger={{ click: 'dismissAlert' }}
                data-alert-id={alert.id}
                aria-label='Dismiss alert'
              >
                ×
              </button>
            </div>
          ))
        )
      },
      dismissAlert(event: { target: HTMLButtonElement }) {
        const alertId = event.target.getAttribute('data-alert-id')
        if (!alertId) return

        const current = alertSignal.get()
        alertSignal.set(current.filter((a) => a.id !== alertId))
      },
    }
  },
})

// Utility function to show alerts
export const showAlert = (message: string, variant: Alert['variant'] = 'info') => {
  const alerts = alertSignal.get()
  const newAlert: Alert = {
    id: `alert-${Date.now()}-${Math.random()}`,
    message,
    variant,
  }
  alertSignal.set([...alerts, newAlert])
}
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - alert containers are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for dismiss button clicks
  - `p-target` for element selection with `$()`
  - `render()` and `insert()` helpers for dynamic alert insertion
  - `attr()` helper for managing alert state
  - Signals for global alert management (optional)
- **Requires external web API**: No - uses standard HTML elements and ARIA
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

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
7. **Consider aria-live regions** - For less urgent updates, use `aria-live="polite"` instead
8. **Static alerts** - Use Functional Templates for alerts present in initial page load
9. **Dynamic alerts** - Use bElements for alerts that appear after user actions or system events

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

**Note**: `role="alert"` and ARIA live regions have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
- MDN: [ARIA alert role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/alert_role)
- MDN: [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- WCAG: [2.2.3 No Timing](https://www.w3.org/WAI/WCAG21/Understanding/no-timing.html)
- WCAG: [2.2.4 Interruptions](https://www.w3.org/WAI/WCAG21/Understanding/interruptions.html)
