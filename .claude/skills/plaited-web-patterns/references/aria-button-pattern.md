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

// Keyboard support
button.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    button.click()
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, buttons are implemented as **Functional Templates (FT)** in stories files, not as bElements. They use native `<button>` elements without Shadow DOM. Buttons can be used inside bElements' shadowDom, but the button templates themselves are simple functional components.

#### Command Button

```typescript
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const PrimaryButton: FT<{ disabled?: boolean; children?: Children }> = ({
  disabled,
  children,
  ...attrs
}) => (
  <button
    type='button'
    {...attrs}
    {...joinStyles(buttonStyles.btn, buttonStyles.primary)}
    disabled={disabled}
  >
    {children}
  </button>
)
```

#### Toggle Button

```typescript
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const ToggleButton: FT<{
  'aria-pressed': 'true' | 'false'
  'aria-label': string
  children?: Children
}> = ({ 'aria-pressed': ariaPressed, 'aria-label': ariaLabel, children, ...attrs }) => (
  <button
    type='button'
    {...attrs}
    {...joinStyles(buttonStyles.btn, buttonStyles.toggle)}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
  >
    {children}
  </button>
)

// Usage in story - state managed externally
export const toggleButtonStory = story({
  intent: 'Toggle button with aria-pressed state',
  template: () => <ToggleButton aria-pressed='false' aria-label='Mute'>Mute</ToggleButton>,
})
```

**Note**: For toggle buttons with dynamic state, the parent bElement manages the state and updates the `aria-pressed` attribute using `attr()` helper:

```typescript
// Inside a bElement's shadowDom and bProgram
bElement({
  tag: 'audio-controls',
  shadowDom: (
    <ToggleButton
      p-target='mute-button'
      aria-pressed='false'
      aria-label='Mute'
      p-trigger={{ click: 'toggleMute' }}
    >
      Mute
    </ToggleButton>
  ),
  bProgram({ $ }) {
    const muteBtn = $('mute-button')[0]
    let muted = false

    return {
      toggleMute() {
        muted = !muted
        muteBtn?.attr('aria-pressed', muted ? 'true' : 'false')
      },
    }
  },
})
```

#### Disabled Button

```typescript
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const DisabledButton: FT<{ children?: Children }> = ({ children, ...attrs }) => (
  <button
    type='button'
    {...attrs}
    {...joinStyles(buttonStyles.btn)}
    disabled
    aria-disabled='true'
  >
    {children}
  </button>
)
```

#### Icon Button

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const IconButton: FT<{
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
  'aria-label': string
  children?: Children
}> = ({
  disabled,
  variant = 'primary',
  'aria-label': ariaLabel,
  children,
  ...attrs
}) => (
  <button
    type='button'
    {...attrs}
    {...joinStyles(
      buttonStyles.btn,
      buttonStyles.icon,
      buttonStyles[variant]
    )}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    {children}
  </button>
)
```

#### Button with Description

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const DescribedButton: FT<{ children?: Children; description: string }> = ({
  children,
  description,
  ...attrs
}) => (
  <>
    <button
      type='button'
      {...attrs}
      {...joinStyles(buttonStyles.btn)}
      aria-describedby='button-description'
    >
      {children}
    </button>
    <span
      id='button-description'
      {...joinStyles(buttonStyles.description)}
    >
      {description}
    </span>
  </>
)
```

#### Story Examples

```typescript
import { story } from 'plaited/testing'

export const primaryButton = story({
  intent: 'Create a primary button with hover and focus states',
  template: () => <PrimaryButton>Click Me</PrimaryButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const primaryButtonDisabled = story({
  intent: 'Create a disabled primary button',
  template: () => <PrimaryButton disabled>Disabled</PrimaryButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const iconButton = story({
  intent: 'Create an accessible icon button',
  template: () => (
    <IconButton aria-label='Close dialog'>
      <CloseIcon />
    </IconButton>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: No - buttons are Functional Templates that render native `<button>` elements directly
- **Uses bElement built-ins**: 
  - Buttons are FT, not bElements
  - When used inside bElements' shadowDom, can use `p-trigger` and `p-target`
  - Parent bElement can manage button state using `attr()` helper
- **Requires external web API**: No - uses standard HTML button element
- **Cleanup required**: No - button element handles its own lifecycle
- **Pattern**: Buttons are defined in `*.stories.tsx` files as Functional Templates

## Keyboard Interaction

When the button has focus:
- **Space**: Activates the button
- **Enter**: Activates the button

**Note**: Native `<button>` elements handle Space and Enter automatically. No additional keyboard handlers are needed for functional template buttons.

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
2. **Define buttons as Functional Templates** in `*.stories.tsx` files, not as bElements
3. **Apply styles using `joinStyles`** from `*.css.ts` files
4. **Maintain consistent labels** for toggle buttons - don't change "Mute" to "Unmute", use `aria-pressed` instead
5. **Manage toggle state in parent bElement** - use `p-target` and `attr()` to update `aria-pressed` dynamically
6. **Provide visual feedback** for disabled states using `disabled` attribute and CSS
7. **Use `aria-describedby`** for additional context that doesn't fit in the label
8. **Spread props with `...attrs`** to allow additional attributes and event handlers

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
