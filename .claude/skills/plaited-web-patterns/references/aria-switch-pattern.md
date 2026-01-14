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
- Switches are functionally similar to checkboxes and toggle buttons but use different semantics
- Choose the role that best matches both the visual design and semantics
- **Critical**: The label on a switch does not change when its state changes
- Use `role="switch"` for on/off semantics, `role="checkbox"` for checked/unchecked, `role="button"` with `aria-pressed` for toggle buttons

**When to Use Switch vs. Checkbox vs. Toggle Button:**
- **Switch**: For on/off states (e.g., "Lights switch on" is more user-friendly than "Lights checkbox checked")
- **Checkbox**: For checked/unchecked states, especially in groups or forms
- **Toggle Button**: For pressed/unpressed states, especially in toolbars

## Use Cases

- Notification preferences (on/off)
- Feature toggles (enable/disable)
- Settings switches (dark mode, auto-save)
- Light controls (on/off)
- Accessibility preferences
- Privacy settings
- Auto-play controls
- Real-time updates toggle

## Implementation

### Vanilla JavaScript

```html
<!-- Switch based on div -->
<div 
  role="switch"
  aria-checked="false"
  aria-label="Enable notifications"
  tabindex="0"
>
  <span class="switch-track">
    <span class="switch-thumb"></span>
  </span>
  <span>Enable notifications</span>
</div>

<!-- Switch based on button -->
<button
  type="button"
  role="switch"
  aria-checked="true"
  aria-label="Lights on"
>
  <span class="switch-track">
    <span class="switch-thumb"></span>
  </span>
  Lights
</button>

<!-- Switch based on checkbox -->
<input
  type="checkbox"
  role="switch"
  aria-checked="false"
  aria-label="Dark mode"
>
<label for="dark-mode">Dark mode</label>
```

```javascript
// Keyboard interaction
switch.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    const currentState = switch.getAttribute('aria-checked') === 'true'
    switch.setAttribute('aria-checked', String(!currentState))
    updateSwitchVisual(!currentState)
  }
})

// Click handler
switch.addEventListener('click', () => {
  const currentState = switch.getAttribute('aria-checked') === 'true'
  switch.setAttribute('aria-checked', String(!currentState))
  updateSwitchVisual(!currentState)
})
```

### Plaited Adaptation

**Important**: In Plaited, switches can be implemented as:
1. **Functional Templates (FT)** for static switches in stories
2. **bElements** for form-associated switches that need form integration
3. **bElements** for switches with dynamic state management

#### Static Switch (Functional Template)

```typescript
// switch.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { switchStyles } from './switch.css.ts'

const Switch: FT<{
  'aria-checked': 'true' | 'false'
  'aria-label'?: string
  disabled?: boolean
  children?: Children
}> = ({
  'aria-checked': ariaChecked,
  'aria-label': ariaLabel,
  disabled,
  children,
  ...attrs
}) => (
  <button
    type='button'
    role='switch'
    aria-checked={ariaChecked}
    aria-label={ariaLabel}
    disabled={disabled}
    tabIndex={disabled ? -1 : 0}
    {...attrs}
    {...joinStyles(switchStyles.switch)}
  >
    <span {...switchStyles.track} aria-hidden='true'>
      <span
        {...switchStyles.thumb}
        data-checked={ariaChecked}
      ></span>
    </span>
    {children && <span {...switchStyles.label}>{children}</span>}
  </button>
)

export const switchStory = story({
  intent: 'Switch in off state',
  template: () => (
    <Switch aria-checked='false' aria-label='Enable notifications'>
      Enable notifications
    </Switch>
  ),
})
```

#### Form-Associated Switch (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles, createHostStyles } from 'plaited/ui'
import { isTypeOf } from 'plaited/utils'

const switchStyles = createStyles({
  switch: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  track: {
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: {
      $default: '#ccc',
      '[aria-checked="true"]': '#007bff',
    },
    transition: 'background-color 0.2s ease',
  },
  thumb: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform 0.2s ease',
    transform: {
      $default: 'translateX(0)',
      '[data-checked="true"]': 'translateX(20px)',
    },
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  label: {
    fontSize: '1rem',
    color: '#333',
  },
})

const hostStyles = createHostStyles({
  display: 'inline-block',
})

type SwitchEvents = {
  change: { checked: boolean; value: string | null }
  toggle: boolean
}

export const FormSwitch = bElement<SwitchEvents>({
  tag: 'form-switch',
  observedAttributes: ['checked', 'disabled', 'value'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <button
      p-target='switch'
      type='button'
      role='switch'
      aria-checked='false'
      tabIndex={0}
      {...switchStyles.switch}
      p-trigger={{ click: 'toggle', keydown: 'handleKeydown' }}
    >
      <span p-target='track' {...switchStyles.track} aria-hidden='true'>
        <span p-target='thumb' {...switchStyles.thumb}></span>
      </span>
      <span p-target='label' {...switchStyles.label}>
        <slot></slot>
      </span>
    </button>
  ),
  bProgram({ $, host, internals, root, trigger, emit }) {
    const switchEl = $('switch')[0]
    const thumb = $('thumb')[0]
    let checked = false

    const updateState = (newChecked: boolean) => {
      checked = newChecked
      switchEl?.attr('aria-checked', checked ? 'true' : 'false')
      thumb?.setAttribute('data-checked', checked ? 'true' : 'false')
      
      // Update form value
      if (checked) {
        internals.setFormValue('on', host.getAttribute('value') || 'on')
        internals.states.add('checked')
      } else {
        internals.setFormValue('off')
        internals.states.delete('checked')
      }
      
      // Update host attribute
      host.toggleAttribute('checked', checked)
      
      trigger({ type: 'toggle', detail: checked })
      emit({
        type: 'change',
        detail: {
          checked,
          value: host.getAttribute('value'),
        },
      })
    }

    return {
      toggle() {
        if (internals.states.has('disabled')) return
        updateState(!checked)
      },
      
      handleKeydown(event: KeyboardEvent) {
        if (internals.states.has('disabled')) return
        
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          updateState(!checked)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          const isChecked = isTypeOf<string>(newValue, 'string')
          if (isChecked !== checked) {
            updateState(isChecked)
          }
        }
        if (name === 'disabled') {
          const isDisabled = isTypeOf<string>(newValue, 'string')
          if (isDisabled) {
            internals.states.add('disabled')
            switchEl?.attr('tabIndex', '-1')
          } else {
            internals.states.delete('disabled')
            switchEl?.attr('tabIndex', '0')
          }
        }
      },
      
      onConnected() {
        // Initialize from attributes
        if (host.hasAttribute('checked')) {
          checked = true
          updateState(true)
        }
        if (host.hasAttribute('disabled')) {
          internals.states.add('disabled')
          switchEl?.attr('tabIndex', '-1')
        }
        
        // Set accessible label from slot content or aria-label
        const label = host.getAttribute('aria-label') || 
                     root.querySelector('slot')?.assignedNodes().map(n => n.textContent).join('').trim() || 
                     'Switch'
        switchEl?.attr('aria-label', label)
      },
    }
  },
})
```

#### Switch Based on Checkbox Input (bElement)

```typescript
export const CheckboxSwitch = bElement<SwitchEvents>({
  tag: 'checkbox-switch',
  observedAttributes: ['checked', 'disabled', 'value'],
  formAssociated: true,
  shadowDom: (
    <label {...switchStyles.container}>
      <input
        p-target='input'
        type='checkbox'
        role='switch'
        {...switchStyles.input}
        p-trigger={{ change: 'handleChange', keydown: 'handleKeydown' }}
      />
      <span p-target='track' {...switchStyles.track} aria-hidden='true'>
        <span p-target='thumb' {...switchStyles.thumb}></span>
      </span>
      <span p-target='label' {...switchStyles.label}>
        <slot></slot>
      </span>
    </label>
  ),
  bProgram({ $, host, internals, root, emit }) {
    const input = $<HTMLInputElement>('input')[0]
    const thumb = $('thumb')[0]
    let checked = false

    const updateState = (newChecked: boolean) => {
      checked = newChecked
      input.checked = checked
      thumb?.setAttribute('data-checked', checked ? 'true' : 'false')
      
      if (checked) {
        internals.setFormValue('on', host.getAttribute('value') || 'on')
        internals.states.add('checked')
      } else {
        internals.setFormValue('off')
        internals.states.delete('checked')
      }
      
      host.toggleAttribute('checked', checked)
      emit({
        type: 'change',
        detail: {
          checked,
          value: host.getAttribute('value'),
        },
      })
    }

    return {
      handleChange(event: { target: HTMLInputElement }) {
        if (internals.states.has('disabled')) return
        updateState(event.target.checked)
      },
      
      handleKeydown(event: KeyboardEvent) {
        if (internals.states.has('disabled')) return
        
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          updateState(!checked)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          const isChecked = isTypeOf<string>(newValue, 'string')
          if (isChecked !== checked) {
            updateState(isChecked)
          }
        }
        if (name === 'disabled') {
          const isDisabled = isTypeOf<string>(newValue, 'string')
          input.disabled = isDisabled
          if (isDisabled) {
            internals.states.add('disabled')
          } else {
            internals.states.delete('disabled')
          }
        }
      },
      
      onConnected() {
        if (host.hasAttribute('checked')) {
          checked = true
          updateState(true)
        }
        if (host.hasAttribute('disabled')) {
          internals.states.add('disabled')
          input.disabled = true
        }
      },
    }
  },
})
```

#### Switch Group Example

```typescript
export const SwitchGroup = bElement<{
  change: { switches: Record<string, boolean> }
}>({
  tag: 'switch-group',
  observedAttributes: ['aria-label'],
  shadowDom: (
    <div
      p-target='group'
      role='group'
      {...switchStyles.group}
    >
      <div p-target='label' {...switchStyles.groupLabel}>
        <slot name='label'></slot>
      </div>
      <div p-target='switches' {...switchStyles.switches}>
        <slot name='switches'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const group = $('group')[0]
    
    return {
      onConnected() {
        const ariaLabel = host.getAttribute('aria-label')
        if (ariaLabel) {
          group?.setAttribute('aria-label', ariaLabel)
        }
        
        // Listen for changes from child switches
        const switches = Array.from(
          root.querySelectorAll('[role="switch"]')
        ) as HTMLElement[]
        
        switches.forEach(switchEl => {
          switchEl.addEventListener('change', () => {
            const allSwitches: Record<string, boolean> = {}
            switches.forEach(s => {
              const label = s.getAttribute('aria-label') || s.textContent || ''
              allSwitches[label] = s.getAttribute('aria-checked') === 'true'
            })
            emit({ type: 'change', detail: { switches: allSwitches } })
          })
        })
      },
    }
  },
})

// Usage
export const notificationSettings = story({
  intent: 'Group of notification switches',
  template: () => (
    <SwitchGroup aria-label='Notification preferences'>
      <h3 slot='label'>Notification Preferences</h3>
      <FormSwitch slot='switches' checked aria-label='Email notifications'>
        Email notifications
      </FormSwitch>
      <FormSwitch slot='switches' checked aria-label='Push notifications'>
        Push notifications
      </FormSwitch>
      <FormSwitch slot='switches' aria-label='SMS notifications'>
        SMS notifications
      </FormSwitch>
    </SwitchGroup>
  ),
})
```

#### Switch Styling Example

```typescript
// switch.css.ts
import { createStyles } from 'plaited/ui'

export const switchStyles = createStyles({
  switch: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    outline: 'none',
    '&:focus-visible': {
      outline: '2px solid #007bff',
      outlineOffset: '2px',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  track: {
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: {
      $default: '#ccc',
      '[aria-checked="true"]': '#007bff',
      ':disabled': '#e0e0e0',
    },
    transition: 'background-color 0.2s ease',
  },
  thumb: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform 0.2s ease',
    transform: {
      $default: 'translateX(0)',
      '[data-checked="true"]': 'translateX(20px)',
    },
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  label: {
    fontSize: '1rem',
    color: '#333',
    userSelect: 'none',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1rem',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
  },
  groupLabel: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  switches: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - switches can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `p-trigger` for events
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

- **Space**: Changes the state of the switch (required)
- **Enter**: Changes the state of the switch (optional)

**Note**: Focus remains on the switch element during operation.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="switch"**: The switch element
- **aria-checked**: `true` when on, `false` when off

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for switch
- **aria-describedby**: References element providing additional description
- **role="group"**: Container for related switches
- **aria-labelledby** on group: References group label element

### HTML Attributes (when using checkbox input)

- **type="checkbox"**: When switch is based on checkbox input
- **checked**: HTML checked attribute (instead of aria-checked)

## Best Practices

1. **Functional Templates** - Use FT for static switches in stories
2. **bElement for form** - Use bElement for form-associated switches
3. **Label consistency** - Label does not change when state changes
4. **Semantic choice** - Use switch for on/off, checkbox for checked/unchecked
5. **Keyboard support** - Implement Space (required) and Enter (optional)
6. **Visual feedback** - Clear indication of on/off state
7. **Focus indicators** - Visible focus indicators for keyboard users
8. **Form association** - Use `formAssociated: true` for form integration
9. **Group organization** - Use `role="group"` for related switches
10. **Accessible names** - Always provide labels for switches

## Accessibility Considerations

- Screen readers announce switch state as "on" or "off"
- Keyboard users can toggle without mouse
- Focus indicators must be visible
- Label should remain constant (don't change label text based on state)
- Switch semantics are more appropriate for on/off than checkbox semantics
- Group switches logically with `role="group"`
- Visual design should clearly indicate on/off state

## Switch Variants

### Toggle Switch
- Standard on/off switch
- Sliding thumb design
- Common for settings/preferences

### Checkbox-Based Switch
- Uses native `<input type="checkbox">`
- Leverages native checkbox behavior
- Easier to implement

### Button-Based Switch
- Uses `<button>` element
- More flexible styling
- Custom behavior

## Switch vs. Checkbox vs. Toggle Button

| Pattern | Role | Semantics | Use Case |
|---------|------|-----------|----------|
| Switch | `role="switch"` | On/Off | "Lights switch on" |
| Checkbox | `role="checkbox"` | Checked/Unchecked | Form selections, groups |
| Toggle Button | `role="button"` with `aria-pressed` | Pressed/Unpressed | Toolbar controls |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA `role="switch"` has universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Switch Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- MDN: [ARIA switch role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/switch_role)
- Related: [Checkbox Pattern](./aria-checkbox-pattern.md) - For checked/unchecked states
- Related: [Button Pattern](./aria-button-pattern.md) - For toggle buttons with `aria-pressed`
