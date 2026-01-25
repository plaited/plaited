# ARIA Switch Pattern

## Overview

A switch is an input widget that allows users to choose one of two values: on or off. Switches are similar to checkboxes and toggle buttons, which can also serve as binary inputs. One difference, however, is that switches can only be used for binary input while checkboxes and toggle buttons allow implementations the option of supporting a third middle state.

**Key Characteristics:**

- **Binary input**: Only two states - on or off (no third state)
- **Semantic difference**: Uses "on/off" semantics rather than "checked/unchecked"
- **Visual design**: Typically styled as a toggle switch (sliding switch)
- **Keyboard interaction**: Space (required), Enter (optional)
- **Form association**: Can be form-associated for native form integration

**Important Notes:**

- The label on a switch does not change when its state changes
- Use `role="switch"` for on/off semantics, `role="checkbox"` for checked/unchecked

**When to Use Switch vs. Checkbox:**

- **Switch**: For on/off states (e.g., "Lights switch on")
- **Checkbox**: For checked/unchecked states, especially in forms

## Use Cases

- Notification preferences (on/off)
- Feature toggles (enable/disable)
- Settings switches (dark mode, auto-save)
- Light controls (on/off)
- Accessibility preferences
- Privacy settings

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Switch based on button -->
<button
  type="button"
  role="switch"
  aria-checked="false"
  aria-label="Enable notifications"
>
  <span class="switch-track">
    <span class="switch-thumb"></span>
  </span>
  Enable notifications
</button>
```

```javascript
// Toggle switch state
switch.addEventListener('click', () => {
  const currentState = switch.getAttribute('aria-checked') === 'true'
  switch.setAttribute('aria-checked', String(!currentState))
})

switch.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    const currentState = switch.getAttribute('aria-checked') === 'true'
    switch.setAttribute('aria-checked', String(!currentState))
  }
})
```

### Plaited Adaptation

**File Structure:**

```
switch/
  switch.css.ts        # Styles (createStyles) - ALWAYS separate
  switch.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### switch.css.ts

```typescript
// switch.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'inline-block',
})

export const styles = createStyles({
  switch: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    outline: 'none',
  },
  switchDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  track: {
    position: 'relative',
    inlineSize: '44px',
    blockSize: '24px',
    borderRadius: '12px',
    backgroundColor: '#ccc',
    transition: 'background-color 0.2s ease',
  },
  trackChecked: {
    backgroundColor: '#007bff',
  },
  thumb: {
    position: 'absolute',
    insetBlockStart: '2px',
    insetInlineStart: '2px',
    inlineSize: '20px',
    blockSize: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  thumbChecked: {
    transform: 'translateX(20px)',
  },
  label: {
    fontSize: '1rem',
    color: '#333',
    userSelect: 'none',
  },
})
```

#### switch.stories.tsx

```typescript
// switch.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './switch.css.ts'

// FunctionalTemplate for static switch - defined locally, NOT exported
const StaticSwitch: FT<{
  checked?: boolean
  disabled?: boolean
  'aria-label'?: string
  children?: Children
}> = ({
  checked,
  disabled,
  'aria-label': ariaLabel,
  children,
  ...attrs
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked ? 'true' : 'false'}
    aria-label={ariaLabel}
    aria-disabled={disabled ? 'true' : undefined}
    tabIndex={disabled ? -1 : 0}
    {...attrs}
    {...styles.switch}
    {...(disabled ? styles.switchDisabled : {})}
  >
    <span
      aria-hidden="true"
      {...styles.track}
      {...(checked ? styles.trackChecked : {})}
    >
      <span {...styles.thumb} {...(checked ? styles.thumbChecked : {})} />
    </span>
    {children && <span {...styles.label}>{children}</span>}
  </button>
)

// bElement for interactive switch - defined locally, NOT exported
const Switch = bElement({
  tag: 'pattern-switch',
  observedAttributes: ['checked', 'disabled'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <button
      p-target="switch"
      type="button"
      role="switch"
      aria-checked="false"
      tabIndex={0}
      {...styles.switch}
      p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
    >
      <span p-target="track" aria-hidden="true" {...styles.track}>
        <span p-target="thumb" {...styles.thumb} />
      </span>
      <span {...styles.label}>
        <slot></slot>
      </span>
    </button>
  ),
  bProgram({ $, host, internals, emit }) {
    const switchEl = $('switch')[0]
    const track = $('track')[0]
    const thumb = $('thumb')[0]
    let checked = false

    const updateState = (newChecked: boolean) => {
      checked = newChecked
      switchEl?.attr('aria-checked', checked ? 'true' : 'false')

      if (checked) {
        track?.attr('class', `${styles.track.classNames.join(' ')} ${styles.trackChecked.classNames.join(' ')}`)
        thumb?.attr('class', `${styles.thumb.classNames.join(' ')} ${styles.thumbChecked.classNames.join(' ')}`)
        internals.setFormValue('on')
        internals.states.add('checked')
      } else {
        track?.attr('class', styles.track.classNames.join(' '))
        thumb?.attr('class', styles.thumb.classNames.join(' '))
        internals.setFormValue('off')
        internals.states.delete('checked')
      }

      host.toggleAttribute('checked', checked)
      emit({ type: 'change', detail: { checked } })
    }

    return {
      toggle() {
        if (host.hasAttribute('disabled')) return
        updateState(!checked)
      },

      handleKeydown(event: KeyboardEvent) {
        if (host.hasAttribute('disabled')) return

        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          updateState(!checked)
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          const isChecked = newValue !== null
          if (isChecked !== checked) {
            updateState(isChecked)
          }
        }
        if (name === 'disabled') {
          const isDisabled = newValue !== null
          switchEl?.attr('tabIndex', isDisabled ? '-1' : '0')
          switchEl?.attr('class', isDisabled
            ? `${styles.switch.classNames.join(' ')} ${styles.switchDisabled.classNames.join(' ')}`
            : styles.switch.classNames.join(' ')
          )
        }
      },

      onConnected() {
        if (host.hasAttribute('checked')) {
          updateState(true)
        }
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          switchEl?.attr('aria-label', ariaLabel)
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const uncheckedSwitch = story({
  intent: 'Display switch in off state',
  template: () => (
    <Switch>Enable notifications</Switch>
  ),
  play: async ({ findByAttribute, assert }) => {
    const switchEl = await findByAttribute('p-target', 'switch')

    assert({
      given: 'switch is rendered',
      should: 'be off initially',
      actual: switchEl?.getAttribute('aria-checked'),
      expected: 'false',
    })
  },
})

export const checkedSwitch = story({
  intent: 'Display switch in on state',
  template: () => (
    <Switch checked>Dark mode</Switch>
  ),
  play: async ({ findByAttribute, assert }) => {
    const switchEl = await findByAttribute('p-target', 'switch')

    assert({
      given: 'switch has checked attribute',
      should: 'be on',
      actual: switchEl?.getAttribute('aria-checked'),
      expected: 'true',
    })
  },
})

export const disabledSwitch = story({
  intent: 'Display disabled switch that cannot be toggled',
  template: () => (
    <Switch disabled>Unavailable option</Switch>
  ),
  play: async ({ findByAttribute, assert }) => {
    const switchEl = await findByAttribute('p-target', 'switch')

    assert({
      given: 'switch is disabled',
      should: 'have tabIndex -1',
      actual: switchEl?.getAttribute('tabIndex'),
      expected: '-1',
    })
  },
})

export const toggleSwitch = story({
  intent: 'Demonstrate switch toggle behavior with click interaction',
  template: () => (
    <Switch>Click to toggle</Switch>
  ),
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const switchEl = await findByAttribute('p-target', 'switch')

    assert({
      given: 'switch is rendered',
      should: 'be off initially',
      actual: switchEl?.getAttribute('aria-checked'),
      expected: 'false',
    })

    if (switchEl) await fireEvent(switchEl, 'click')

    assert({
      given: 'switch is clicked',
      should: 'become on',
      actual: switchEl?.getAttribute('aria-checked'),
      expected: 'true',
    })

    if (switchEl) await fireEvent(switchEl, 'click')

    assert({
      given: 'switch is clicked again',
      should: 'become off',
      actual: switchEl?.getAttribute('aria-checked'),
      expected: 'false',
    })
  },
})

export const staticSwitches = story({
  intent: 'Static FunctionalTemplate switches for non-interactive display',
  template: () => (
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <StaticSwitch checked={false}>Off</StaticSwitch>
      <StaticSwitch checked>On</StaticSwitch>
      <StaticSwitch disabled>Disabled</StaticSwitch>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - switches are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

- **Space**: Toggles switch state (required)
- **Enter**: Toggles switch state (optional)

**Note**: Focus remains on the switch element during operation.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="switch"**: The switch element
- **aria-checked**: `true` when on, `false` when off

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for switch
- **aria-describedby**: References element providing additional description

## Best Practices

1. **Use FunctionalTemplates** for static switches in stories
2. **Use bElements** for form-associated switches
3. **Label consistency** - Label does not change when state changes
4. **Semantic choice** - Use switch for on/off, checkbox for checked/unchecked
5. **Keyboard support** - Implement Space (required) and Enter (optional)
6. **Use spread syntax** - `{...styles.x}` for applying styles
7. **Use `$()` with `p-target`** - never use `querySelector` directly
8. **Use `formAssociated: true`** for form integration

## Accessibility Considerations

- Screen readers announce switch state as "on" or "off"
- Keyboard users can toggle without mouse
- Focus indicators must be visible
- Label should remain constant

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Switch Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- MDN: [ARIA switch role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/switch_role)
- Related: [Checkbox Pattern](./aria-checkbox-pattern.md)
