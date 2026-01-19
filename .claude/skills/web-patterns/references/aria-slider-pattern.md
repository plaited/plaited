# ARIA Slider Pattern

## Overview

A slider is an input where the user selects a value from within a given range. Sliders typically have a slider thumb that can be moved along a bar, rail, or track to change the value of the slider.

**Key Characteristics:**

- **Range input**: Selects value from min to max
- **Thumb control**: Visual thumb that moves along track
- **Keyboard navigation**: Arrow keys, Home, End, Page Up/Down
- **Orientation**: Horizontal (default) or vertical
- **Step values**: Can have discrete steps or continuous values
- **Form association**: Can be form-associated for native form integration

**Important Warning**: Some users of touch-based assistive technologies may experience difficulty utilizing widgets that implement this slider pattern because the gestures their assistive technology provides for operating sliders may not yet generate the necessary output.

**Native HTML First:** Consider using native `<input type="range">` which provides built-in keyboard support and touch handling.

## Use Cases

- Volume controls
- Brightness/contrast settings
- Temperature controls
- Color picker elements (RGB, HSL)
- Media seek controls (video/audio)
- Rating scales
- Price range filters
- Zoom controls

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Native HTML range input -->
<input
  type="range"
  min="0"
  max="100"
  value="50"
  step="1"
  aria-label="Volume"
>

<!-- ARIA slider (when native element can't be used) -->
<div
  role="slider"
  aria-valuenow="50"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Volume"
  tabindex="0"
>
  <div class="track">
    <div class="thumb" style="inset-inline-start: 50%"></div>
  </div>
</div>
```

```javascript
// Keyboard navigation
slider.addEventListener('keydown', (e) => {
  const currentValue = Number(slider.getAttribute('aria-valuenow'))
  const min = Number(slider.getAttribute('aria-valuemin'))
  const max = Number(slider.getAttribute('aria-valuemax'))
  const step = Number(slider.getAttribute('data-step') || 1)

  let newValue = currentValue

  switch(e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      e.preventDefault()
      newValue = Math.min(max, currentValue + step)
      break
    case 'ArrowLeft':
    case 'ArrowDown':
      e.preventDefault()
      newValue = Math.max(min, currentValue - step)
      break
    case 'Home':
      e.preventDefault()
      newValue = min
      break
    case 'End':
      e.preventDefault()
      newValue = max
      break
  }

  if (newValue !== currentValue) {
    slider.setAttribute('aria-valuenow', newValue)
    updateSliderVisual(newValue, min, max)
  }
})
```

### Plaited Adaptation

**File Structure:**

```
slider/
  slider.css.ts        # Styles (createStyles) - ALWAYS separate
  slider.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### slider.css.ts

```typescript
// slider.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
  inlineSize: '100%',
})

export const styles = createStyles({
  slider: {
    position: 'relative',
    inlineSize: '100%',
    blockSize: '40px',
    display: 'flex',
    alignItems: 'center',
  },
  track: {
    position: 'relative',
    inlineSize: '100%',
    blockSize: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  fill: {
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: 0,
    blockSize: '100%',
    backgroundColor: '#007bff',
    borderRadius: '4px',
    transition: 'inline-size 0.1s ease',
  },
  thumb: {
    position: 'absolute',
    insetBlockStart: '50%',
    transform: 'translate(-50%, -50%)',
    inlineSize: '20px',
    blockSize: '20px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    cursor: 'grab',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  value: {
    position: 'absolute',
    insetBlockStart: '-25px',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.75em',
    fontWeight: 'bold',
    color: '#333',
    whiteSpace: 'nowrap',
  },
  label: {
    fontSize: '0.875em',
    color: '#666',
    marginBlockEnd: '0.5rem',
  },
})
```

#### slider.stories.tsx

```typescript
// slider.stories.tsx
import type { FT } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './slider.css.ts'

// FunctionalTemplate for static slider display - defined locally, NOT exported
const StaticSlider: FT<{
  value: number
  min?: number
  max?: number
  'aria-label'?: string
}> = ({
  value,
  min = 0,
  max = 100,
  'aria-label': ariaLabel,
  ...attrs
}) => {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={ariaLabel}
      tabIndex={0}
      {...attrs}
      {...styles.slider}
    >
      <div {...styles.track}>
        <div {...styles.fill} style={{ inlineSize: `${percentage}%` }} />
        <div {...styles.thumb} style={{ insetInlineStart: `${percentage}%` }} />
      </div>
    </div>
  )
}

// bElement for interactive slider - defined locally, NOT exported
const Slider = bElement({
  tag: 'pattern-slider',
  observedAttributes: ['value', 'min', 'max', 'step'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target="slider"
      role="slider"
      aria-valuenow="50"
      aria-valuemin="0"
      aria-valuemax="100"
      tabIndex={0}
      {...styles.slider}
      p-trigger={{ keydown: 'handleKeydown', mousedown: 'handleMouseDown' }}
    >
      <div p-target="track" {...styles.track}>
        <div p-target="fill" {...styles.fill} />
        <div p-target="thumb" {...styles.thumb} />
      </div>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const slider = $('slider')[0]
    const track = $('track')[0]
    const fill = $('fill')[0]
    const thumb = $('thumb')[0]

    let currentValue = 50
    let min = 0
    let max = 100
    let step = 1
    let isDragging = false

    const getPercentage = (value: number): number => {
      return ((value - min) / (max - min)) * 100
    }

    const getValueFromPosition = (clientX: number): number => {
      const rect = track?.getBoundingClientRect()
      if (!rect) return currentValue

      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      const rawValue = min + (percentage / 100) * (max - min)

      return Math.round(rawValue / step) * step
    }

    const updateValue = (newValue: number, emitEvent = true) => {
      currentValue = Math.max(min, Math.min(max, newValue))
      const percentage = getPercentage(currentValue)

      thumb?.attr('style', `inset-inline-start: ${percentage}%`)
      fill?.attr('style', `inline-size: ${percentage}%`)
      slider?.attr('aria-valuenow', String(currentValue))

      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))

      if (emitEvent) {
        emit({ type: 'input', detail: { value: currentValue } })
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return
      const newValue = getValueFromPosition(event.clientX)
      updateValue(newValue)
    }

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false
        emit({ type: 'change', detail: { value: currentValue } })
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        let newValue = currentValue

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            event.preventDefault()
            newValue = Math.min(max, currentValue + step)
            break
          case 'ArrowLeft':
          case 'ArrowDown':
            event.preventDefault()
            newValue = Math.max(min, currentValue - step)
            break
          case 'Home':
            event.preventDefault()
            newValue = min
            break
          case 'End':
            event.preventDefault()
            newValue = max
            break
          case 'PageUp':
            event.preventDefault()
            newValue = Math.min(max, currentValue + step * 10)
            break
          case 'PageDown':
            event.preventDefault()
            newValue = Math.max(min, currentValue - step * 10)
            break
        }

        if (newValue !== currentValue) {
          updateValue(newValue)
          emit({ type: 'change', detail: { value: currentValue } })
        }
      },

      handleMouseDown(event: MouseEvent) {
        event.preventDefault()
        isDragging = true
        const newValue = getValueFromPosition(event.clientX)
        updateValue(newValue)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },

      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')

        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (stepAttr) step = Number(stepAttr)
        if (valueAttr) {
          updateValue(Number(valueAttr), false)
        } else {
          updateValue(min, false)
        }
        if (ariaLabel) {
          slider?.attr('aria-label', ariaLabel)
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateValue(Number(newValue))
        } else if (name === 'min' && newValue) {
          min = Number(newValue)
          updateValue(currentValue)
        } else if (name === 'max' && newValue) {
          max = Number(newValue)
          updateValue(currentValue)
        } else if (name === 'step' && newValue) {
          step = Number(newValue)
        }
      },

      onDisconnected() {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const defaultSlider = story({
  intent: 'Display a slider at 50% with default range',
  template: () => (
    <Slider value="50" min="0" max="100" aria-label="Volume" />
  ),
  play: async ({ findByAttribute, assert }) => {
    const slider = await findByAttribute('p-target', 'slider')

    assert({
      given: 'slider is rendered',
      should: 'have aria-valuenow of 50',
      actual: slider?.getAttribute('aria-valuenow'),
      expected: '50',
    })
  },
})

export const volumeSlider = story({
  intent: 'Interactive volume slider with keyboard support',
  template: () => (
    <Slider value="75" min="0" max="100" step="5" aria-label="Volume" />
  ),
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const slider = await findByAttribute('p-target', 'slider')

    assert({
      given: 'slider is rendered',
      should: 'start at 75',
      actual: slider?.getAttribute('aria-valuenow'),
      expected: '75',
    })

    if (slider) {
      await fireEvent(slider, 'keydown', { key: 'ArrowRight' })
    }

    assert({
      given: 'ArrowRight is pressed',
      should: 'increase value by step',
      actual: slider?.getAttribute('aria-valuenow'),
      expected: '80',
    })
  },
})

export const staticSliders = story({
  intent: 'Static slider display for non-interactive contexts',
  template: () => (
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <StaticSlider value={0} aria-label="Minimum" />
      <StaticSlider value={50} aria-label="Middle" />
      <StaticSlider value={100} aria-label="Maximum" />
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - sliders are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No
- **Cleanup required**: Yes - mouse event listeners in `onDisconnected`

## Keyboard Interaction

- **ArrowRight/ArrowUp**: Increase value by one step
- **ArrowLeft/ArrowDown**: Decrease value by one step
- **Home**: Set to minimum value
- **End**: Set to maximum value
- **PageUp** (Optional): Increase by larger step (e.g., 10 steps)
- **PageDown** (Optional): Decrease by larger step (e.g., 10 steps)

**Note**: Focus is placed on the slider element.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="slider"**: The focusable slider control
- **aria-valuenow**: Current value (decimal)
- **aria-valuemin**: Minimum allowed value (decimal)
- **aria-valuemax**: Maximum allowed value (decimal)

### Optional

- **aria-valuetext**: Human-readable text alternative
- **aria-label** or **aria-labelledby**: Accessible name for slider
- **aria-orientation**: `vertical` for vertical slider (default: `horizontal`)

## Best Practices

1. **Use native `<input type="range">`** when possible
2. **Use FunctionalTemplates** for static display
3. **Use bElements** for interactive sliders
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Use `$()` with `p-target`** - never use `querySelector` directly
6. **Use `formAssociated: true`** for form integration
7. **Cleanup event listeners** in `onDisconnected`

## Accessibility Considerations

- Screen readers announce slider value and range
- Keyboard users can adjust value without mouse
- Focus indicators must be visible
- `aria-valuetext` provides context beyond numeric value

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- MDN: [HTML input type="range"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range)
- MDN: [ARIA slider role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/slider_role)
