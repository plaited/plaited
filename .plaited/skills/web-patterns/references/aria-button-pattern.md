# ARIA Button Pattern

## Overview

A button is a widget that enables users to trigger an action or event, such as submitting a form, opening a dialog, canceling an action, or performing a delete operation. This pattern covers three types of buttons:

1. **Command Button**: Standard button that triggers an action
2. **Toggle Button**: Two-state button that can be off (not pressed) or on (pressed)
3. **Menu Button**: Button that opens a menu (see menu button pattern for full details)

## Use Cases

- Triggering actions (submit, cancel, delete)
- Opening dialogs or modals
- Toggling states (mute/unmute, expand/collapse)
- Launching menus or dropdowns
- Form submission
- Navigation actions that aren't links

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Standard button -->
<button type="button" aria-label="Close dialog">Close</button>

<!-- Toggle button -->
<button type="button" aria-pressed="false" aria-label="Mute">Mute</button>

<!-- Disabled button -->
<button type="button" aria-disabled="true">Unavailable</button>
```

```javascript
// Toggle button handler
button.addEventListener('click', () => {
  const pressed = button.getAttribute('aria-pressed') === 'true'
  button.setAttribute('aria-pressed', String(!pressed))
})

// Note: Native <button> handles Enter/Space automatically
// No additional keyboard handlers needed
```

### Plaited Adaptation

**Native HTML First:** Buttons should use native `<button>` elements which provide built-in keyboard support (Enter/Space), focus management, and semantics. Avoid custom keyboard handlers for basic button functionality.

**File Structure:**

```
button/
  button.css.ts        # Styles (createStyles) - ALWAYS separate
  button.stories.tsx   # FT + stories (imports from css.ts)
```

#### button.css.ts

```typescript
// button.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  btn: {
    padding: '0.5rem 1rem',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  primary: {
    backgroundColor: '#0066cc',
    color: 'white',
    borderColor: '#0066cc',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: '#0066cc',
    borderColor: '#0066cc',
  },
  outline: {
    backgroundColor: 'transparent',
    color: '#333',
    borderColor: '#ccc',
  },
  toggle: {
    backgroundColor: '#f0f0f0',
    color: '#333',
    borderColor: '#ccc',
  },
  togglePressed: {
    backgroundColor: '#0066cc',
    color: 'white',
    borderColor: '#0066cc',
  },
  icon: {
    padding: '0.5rem',
    minInlineSize: '2.5rem',
    minBlockSize: '2.5rem',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  description: {
    fontSize: '0.875rem',
    color: '#666',
    marginBlockStart: '0.25rem',
  },
})
```

#### button.stories.tsx

```typescript
// button.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './button.css.ts'

// FunctionalTemplate - defined locally, NOT exported
const PrimaryButton: FT<{ disabled?: boolean; children?: Children }> = ({
  disabled,
  children,
  ...attrs
}) => (
  <button
    type="button"
    {...attrs}
    {...styles.btn}
    {...styles.primary}
    {...(disabled ? styles.disabled : {})}
    disabled={disabled}
  >
    {children}
  </button>
)

const SecondaryButton: FT<{ disabled?: boolean; children?: Children }> = ({
  disabled,
  children,
  ...attrs
}) => (
  <button
    type="button"
    {...attrs}
    {...styles.btn}
    {...styles.secondary}
    {...(disabled ? styles.disabled : {})}
    disabled={disabled}
  >
    {children}
  </button>
)

const OutlineButton: FT<{ disabled?: boolean; children?: Children }> = ({
  disabled,
  children,
  ...attrs
}) => (
  <button
    type="button"
    {...attrs}
    {...styles.btn}
    {...styles.outline}
    {...(disabled ? styles.disabled : {})}
    disabled={disabled}
  >
    {children}
  </button>
)

const IconButton: FT<{
  disabled?: boolean
  'aria-label': string
  children?: Children
}> = ({ disabled, 'aria-label': ariaLabel, children, ...attrs }) => (
  <button
    type="button"
    {...attrs}
    {...styles.btn}
    {...styles.icon}
    {...styles.primary}
    {...(disabled ? styles.disabled : {})}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    {children}
  </button>
)

// bElement for toggle button with state management - defined locally, NOT exported
const ToggleButton = bElement({
  tag: 'pattern-toggle-button',
  observedAttributes: ['aria-pressed'],
  shadowDom: (
    <button
      type="button"
      p-target="button"
      p-trigger={{ click: 'toggle' }}
      aria-pressed="false"
      {...styles.btn}
      {...styles.toggle}
    >
      <slot></slot>
    </button>
  ),
  bProgram({ $, emit, host }) {
    const button = $('button')[0]

    return {
      toggle() {
        const isPressed = button?.attr('aria-pressed') === 'true'
        const newPressed = !isPressed
        button?.attr('aria-pressed', newPressed ? 'true' : 'false')

        // Update visual state
        if (newPressed) {
          button?.attr('class', `${styles.btn.classNames.join(' ')} ${styles.togglePressed.classNames.join(' ')}`)
        } else {
          button?.attr('class', `${styles.btn.classNames.join(' ')} ${styles.toggle.classNames.join(' ')}`)
        }

        emit({ type: 'toggle', detail: { pressed: newPressed } })
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'aria-pressed') {
          button?.attr('aria-pressed', newValue ?? 'false')
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const primaryButton = story({
  intent: 'Primary action button with filled background for main actions',
  template: () => <PrimaryButton>Click Me</PrimaryButton>,
  play: async ({ findByRole, assert, accessibilityCheck }) => {
    const button = await findByRole('button')

    assert({
      given: 'primary button is rendered',
      should: 'have type="button"',
      actual: button?.getAttribute('type'),
      expected: 'button',
    })

    await accessibilityCheck({})
  },
})

export const secondaryButton = story({
  intent: 'Secondary action button with outline style for less prominent actions',
  template: () => <SecondaryButton>Secondary Action</SecondaryButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const outlineButton = story({
  intent: 'Outline button with subtle border for tertiary actions',
  template: () => <OutlineButton>Outline Button</OutlineButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const disabledButton = story({
  intent: 'Disabled button that prevents user interaction',
  template: () => <PrimaryButton disabled>Disabled</PrimaryButton>,
  play: async ({ findByRole, assert }) => {
    const button = await findByRole('button')

    assert({
      given: 'disabled button is rendered',
      should: 'have disabled attribute',
      actual: button?.hasAttribute('disabled'),
      expected: true,
    })
  },
})

export const iconButton = story({
  intent: 'Icon-only button with aria-label for accessibility',
  template: () => (
    <IconButton aria-label="Close dialog">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4l8 8M4 12l8-8" stroke="currentColor" stroke-width="2" />
      </svg>
    </IconButton>
  ),
  play: async ({ findByRole, assert }) => {
    const button = await findByRole('button')

    assert({
      given: 'icon button is rendered',
      should: 'have aria-label',
      actual: button?.getAttribute('aria-label'),
      expected: 'Close dialog',
    })
  },
})

export const toggleButton = story({
  intent: 'Toggle button with aria-pressed state management',
  template: () => <ToggleButton aria-label="Mute">Mute</ToggleButton>,
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const button = await findByAttribute('p-target', 'button')

    assert({
      given: 'toggle button is rendered',
      should: 'have aria-pressed="false" initially',
      actual: button?.getAttribute('aria-pressed'),
      expected: 'false',
    })

    if (button) await fireEvent(button, 'click')

    assert({
      given: 'toggle button is clicked',
      should: 'have aria-pressed="true"',
      actual: button?.getAttribute('aria-pressed'),
      expected: 'true',
    })
  },
})

export const toggleButtonInBElement = story({
  intent: 'Toggle button used inside a parent bElement with state coordination',
  template: () => (
    <div>
      <p>Click the mute button to toggle audio state:</p>
      <ToggleButton aria-label="Mute audio">
        🔊 Mute
      </ToggleButton>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Optional - buttons can be FT (no Shadow DOM) or bElements (with Shadow DOM for toggle state)
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

When the button has focus:

- **Space**: Activates the button
- **Enter**: Activates the button

**Note**: Native `<button>` elements handle Space and Enter automatically. No additional keyboard handlers are needed for FunctionalTemplate buttons.

## WAI-ARIA Roles, States, and Properties

### Required

- **role**: `button` (implicit on `<button>` element)
- **Accessible label**: Provided via text content, `aria-label`, or `aria-labelledby`

### Optional

- **aria-disabled**: Set to `true` when button action is unavailable
- **aria-pressed**: For toggle buttons - `true` when pressed, `false` when not pressed
- **aria-describedby**: ID reference to element containing button description
- **aria-haspopup**: Set to `menu` or `true` for menu buttons (see menu button pattern)

## Best Practices

1. **Use native `<button>` elements** - they provide built-in keyboard support and semantics
2. **Use FunctionalTemplates** for stateless buttons
3. **Use bElements** for toggle buttons that need state management
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Maintain consistent labels** for toggle buttons - don't change "Mute" to "Unmute", use `aria-pressed` instead
6. **Provide visual feedback** for disabled states using `disabled` attribute and CSS
7. **Use `aria-describedby`** for additional context that doesn't fit in the label
8. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce button role, label, and state (pressed/disabled)
- Keyboard users can activate buttons with Space or Enter
- Focus indicators must be visible (use `:focus` styles)
- Disabled buttons should be clearly distinguishable visually
- Toggle buttons should maintain consistent labels regardless of state

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: Native `<button>` elements have universal support. ARIA attributes are supported in all modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
- MDN: [HTML button element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button)
- MDN: [ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
