# ARIA Slider (Multi-Thumb) Pattern

## Overview

A multi-thumb slider implements the Slider Pattern but includes two or more thumbs, often on a single rail. Each thumb sets one of the values in a group of related values. For example, in a product search, a two-thumb slider could be used to enable users to set the minimum and maximum price limits for the search.

**Key Characteristics:**
- **Multiple thumbs**: Two or more slider thumbs on a single rail
- **Related values**: Each thumb sets one value in a group
- **Constraints**: Thumbs may or may not be allowed to pass each other
- **Independent operation**: Each thumb has its own keyboard interactions
- **Tab order**: Remains constant regardless of visual position
- **Form association**: Can be form-associated using FormData for multiple values

**Important Warning**: Some users of touch-based assistive technologies may experience difficulty utilizing widgets that implement this slider pattern because the gestures their assistive technology provides for operating sliders may not yet generate the necessary output. Authors should fully test slider widgets using assistive technologies on devices where touch is a primary input mechanism before considering incorporation into production systems.

**Common Constraint Patterns:**
- **Range constraint**: In a two-thumb slider for min/max, thumbs cannot pass each other
- **Independent values**: Each thumb sets a value that doesn't depend on other thumbs
- **Dependent ranges**: When one thumb changes, it may update the min/max of other thumbs

## Use Cases

- Price range filters (min/max price)
- Date range selectors (start/end date)
- Time range selectors (start/end time)
- Size range filters (min/max size)
- Age range selectors
- Rating range filters
- Multi-value color pickers (RGB, HSL)
- Independent parameter controls (multiple unrelated values)

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Two-thumb price range slider -->
<div role="group" aria-label="Price range">
  <div
    role="slider"
    aria-valuenow="50"
    aria-valuemin="0"
    aria-valuemax="200"
    aria-label="Minimum price"
    tabindex="0"
    data-thumb="min"
  >
    <div class="track">
      <div class="thumb-min" style="inset-inline-start: 25%"></div>
      <div class="thumb-max" style="inset-inline-start: 75%"></div>
    </div>
  </div>
  <div
    role="slider"
    aria-valuenow="150"
    aria-valuemin="50"
    aria-valuemax="200"
    aria-label="Maximum price"
    tabindex="0"
    data-thumb="max"
  >
  </div>
</div>
```

```javascript
// Two-thumb range slider with constraints
const minThumb = document.querySelector('[data-thumb="min"]')
const maxThumb = document.querySelector('[data-thumb="max"]')
let minValue = 50
let maxValue = 150
const absoluteMin = 0
const absoluteMax = 200

function updateMinValue(newValue) {
  // Constraint: min cannot exceed max
  minValue = Math.min(newValue, maxValue - 1)
  minThumb.setAttribute('aria-valuenow', minValue)
  minThumb.setAttribute('aria-valuemax', maxValue)
  updateVisual()
}

function updateMaxValue(newValue) {
  // Constraint: max cannot be less than min
  maxValue = Math.max(newValue, minValue + 1)
  maxThumb.setAttribute('aria-valuenow', maxValue)
  maxThumb.setAttribute('aria-valuemin', minValue)
  updateVisual()
}

// Keyboard navigation for each thumb
minThumb.addEventListener('keydown', (e) => {
  const step = 10
  let newValue = minValue

  switch(e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      e.preventDefault()
      newValue = Math.min(maxValue - 1, minValue + step)
      break
    case 'ArrowLeft':
    case 'ArrowDown':
      e.preventDefault()
      newValue = Math.max(absoluteMin, minValue - step)
      break
    case 'Home':
      e.preventDefault()
      newValue = absoluteMin
      break
    case 'End':
      e.preventDefault()
      newValue = maxValue - 1
      break
  }

  if (newValue !== minValue) {
    updateMinValue(newValue)
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, multi-thumb sliders are implemented as **bElements** because they require:
- Complex state management (multiple values, constraints)
- Keyboard navigation for each thumb
- Mouse drag support for each thumb
- Form association with FormData for multiple values
- Tab order management

**File Structure:**

```
range-slider/
  range-slider.css.ts        # Styles (createStyles) - ALWAYS separate
  range-slider.stories.tsx   # bElement + stories (imports from css.ts)
```

#### range-slider.css.ts

```typescript
// range-slider.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
  inlineSize: '100%',
})

export const styles = createStyles({
  container: {
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
  },
  fill: {
    position: 'absolute',
    insetBlockStart: 0,
    blockSize: '100%',
    backgroundColor: '#007bff',
    borderRadius: '4px',
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
    zIndex: 2,
  },
  thumbFocused: {
    zIndex: 3,
    outline: '2px solid #0056b3',
    outlineOffset: '2px',
  },
  label: {
    fontSize: '0.875em',
    color: '#666',
    marginBlockEnd: '0.5rem',
  },
  value: {
    fontSize: '0.875em',
    fontWeight: 'bold',
    marginBlockStart: '0.5rem',
  },
})
```

#### range-slider.stories.tsx

```typescript
// range-slider.stories.tsx
import type { FT } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './range-slider.css.ts'

// Type for events - defined locally
type RangeSliderEvents = {
  input: { min: number; max: number }
  change: { min: number; max: number }
}

// bElement for range slider - defined locally, NOT exported
const RangeSlider = bElement<RangeSliderEvents>({
  tag: 'pattern-range-slider',
  observedAttributes: ['min', 'max', 'min-value', 'max-value', 'step', 'aria-label'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div {...styles.container}>
      <div p-target='label' {...styles.label}>
        <slot name='label'></slot>
      </div>
      <div
        p-target='track'
        {...styles.track}
        aria-hidden='true'
        p-trigger={{ click: 'handleTrackClick' }}
      >
        <div p-target='fill' {...styles.fill}></div>
        <div
          p-target='min-thumb'
          role='slider'
          data-thumb='min'
          tabIndex={0}
          {...styles.thumb}
          p-trigger={{ keydown: 'handleMinKeydown', mousedown: 'handleMinMouseDown', focus: 'handleMinFocus', blur: 'handleMinBlur' }}
        ></div>
        <div
          p-target='max-thumb'
          role='slider'
          data-thumb='max'
          tabIndex={0}
          {...styles.thumb}
          p-trigger={{ keydown: 'handleMaxKeydown', mousedown: 'handleMaxMouseDown', focus: 'handleMaxFocus', blur: 'handleMaxBlur' }}
        ></div>
      </div>
      <div p-target='value' {...styles.value}></div>
    </div>
  ),
  bProgram({ $, host, internals, emit }) {
    const track = $('track')[0]
    const fill = $('fill')[0]
    const minThumb = $('min-thumb')[0]
    const maxThumb = $('max-thumb')[0]
    const valueDisplay = $('value')[0]

    let absoluteMin = 0
    let absoluteMax = 100
    let minValue = 20
    let maxValue = 80
    let step = 1
    let isDragging = false
    let draggingThumb: 'min' | 'max' | null = null

    const getPercentage = (value: number): number => {
      return ((value - absoluteMin) / (absoluteMax - absoluteMin)) * 100
    }

    const getValueFromPosition = (clientX: number): number => {
      const rect = track?.getBoundingClientRect()
      if (!rect) return minValue

      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      const rawValue = absoluteMin + (percentage / 100) * (absoluteMax - absoluteMin)

      return Math.round(rawValue / step) * step
    }

    const updateMinValue = (newValue: number, emitEvent = true) => {
      minValue = Math.max(absoluteMin, Math.min(maxValue - step, newValue))
      const percentage = getPercentage(minValue)

      minThumb?.attr('style', `inset-inline-start: ${percentage}%`)
      minThumb?.attr('aria-valuenow', String(minValue))
      minThumb?.attr('aria-valuemin', String(absoluteMin))
      minThumb?.attr('aria-valuemax', String(maxValue - step))

      const minPercent = getPercentage(minValue)
      const maxPercent = getPercentage(maxValue)
      fill?.attr('style', `inset-inline-start: ${minPercent}%; inline-size: ${maxPercent - minPercent}%`)

      updateFormValue()
      updateValueDisplay()

      if (emitEvent) {
        emit({ type: 'input', detail: { min: minValue, max: maxValue } })
      }
    }

    const updateMaxValue = (newValue: number, emitEvent = true) => {
      maxValue = Math.min(absoluteMax, Math.max(minValue + step, newValue))
      const percentage = getPercentage(maxValue)

      maxThumb?.attr('style', `inset-inline-start: ${percentage}%`)
      maxThumb?.attr('aria-valuenow', String(maxValue))
      maxThumb?.attr('aria-valuemin', String(minValue + step))
      maxThumb?.attr('aria-valuemax', String(absoluteMax))

      const minPercent = getPercentage(minValue)
      const maxPercent = getPercentage(maxValue)
      fill?.attr('style', `inset-inline-start: ${minPercent}%; inline-size: ${maxPercent - minPercent}%`)

      updateFormValue()
      updateValueDisplay()

      if (emitEvent) {
        emit({ type: 'input', detail: { min: minValue, max: maxValue } })
      }
    }

    const updateFormValue = () => {
      const formData = new FormData()
      const name = host.getAttribute('name') || 'range'

      formData.append(`${name}[min]`, String(minValue))
      formData.append(`${name}[max]`, String(maxValue))

      internals.setFormValue(formData)
      host.setAttribute('min-value', String(minValue))
      host.setAttribute('max-value', String(maxValue))
    }

    const updateValueDisplay = () => {
      const ariaLabel = host.getAttribute('aria-label') || 'Range'
      valueDisplay?.render(`${ariaLabel}: $${minValue} - $${maxValue}`)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !draggingThumb) return

      const newValue = getValueFromPosition(event.clientX)

      if (draggingThumb === 'min') {
        updateMinValue(newValue)
      } else {
        updateMaxValue(newValue)
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false
        emit({ type: 'change', detail: { min: minValue, max: maxValue } })
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        draggingThumb = null
      }
    }

    return {
      handleMinKeydown(event: KeyboardEvent) {
        let newValue = minValue

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            event.preventDefault()
            newValue = Math.min(maxValue - step, minValue + step)
            break
          case 'ArrowLeft':
          case 'ArrowDown':
            event.preventDefault()
            newValue = Math.max(absoluteMin, minValue - step)
            break
          case 'Home':
            event.preventDefault()
            newValue = absoluteMin
            break
          case 'End':
            event.preventDefault()
            newValue = maxValue - step
            break
        }

        if (newValue !== minValue) {
          updateMinValue(newValue)
          emit({ type: 'change', detail: { min: minValue, max: maxValue } })
        }
      },

      handleMaxKeydown(event: KeyboardEvent) {
        let newValue = maxValue

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            event.preventDefault()
            newValue = Math.min(absoluteMax, maxValue + step)
            break
          case 'ArrowLeft':
          case 'ArrowDown':
            event.preventDefault()
            newValue = Math.max(minValue + step, maxValue - step)
            break
          case 'Home':
            event.preventDefault()
            newValue = minValue + step
            break
          case 'End':
            event.preventDefault()
            newValue = absoluteMax
            break
        }

        if (newValue !== maxValue) {
          updateMaxValue(newValue)
          emit({ type: 'change', detail: { min: minValue, max: maxValue } })
        }
      },

      handleMinMouseDown(event: MouseEvent) {
        event.preventDefault()
        isDragging = true
        draggingThumb = 'min'
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },

      handleMaxMouseDown(event: MouseEvent) {
        event.preventDefault()
        isDragging = true
        draggingThumb = 'max'
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },

      handleTrackClick(event: MouseEvent) {
        if (isDragging) return

        const newValue = getValueFromPosition(event.clientX)
        const minPercent = getPercentage(minValue)
        const maxPercent = getPercentage(maxValue)
        const clickPercent = getPercentage(newValue)

        const distToMin = Math.abs(clickPercent - minPercent)
        const distToMax = Math.abs(clickPercent - maxPercent)

        if (distToMin < distToMax) {
          updateMinValue(newValue)
        } else {
          updateMaxValue(newValue)
        }

        emit({ type: 'change', detail: { min: minValue, max: maxValue } })
      },

      handleMinFocus() {
        minThumb?.attr('class', `${styles.thumb.classNames.join(' ')} ${styles.thumbFocused.classNames.join(' ')}`)
      },

      handleMaxFocus() {
        maxThumb?.attr('class', `${styles.thumb.classNames.join(' ')} ${styles.thumbFocused.classNames.join(' ')}`)
      },

      handleMinBlur() {
        minThumb?.attr('class', styles.thumb.classNames.join(' '))
      },

      handleMaxBlur() {
        maxThumb?.attr('class', styles.thumb.classNames.join(' '))
      },

      onConnected() {
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const minValueAttr = host.getAttribute('min-value')
        const maxValueAttr = host.getAttribute('max-value')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')

        if (minAttr) absoluteMin = Number(minAttr)
        if (maxAttr) absoluteMax = Number(maxAttr)
        if (minValueAttr) minValue = Number(minValueAttr)
        if (maxValueAttr) maxValue = Number(maxValueAttr)
        if (stepAttr) step = Number(stepAttr)

        minValue = Math.max(absoluteMin, Math.min(maxValue - step, minValue))
        maxValue = Math.min(absoluteMax, Math.max(minValue + step, maxValue))

        if (ariaLabel) {
          minThumb?.attr('aria-label', `Minimum ${ariaLabel}`)
          maxThumb?.attr('aria-label', `Maximum ${ariaLabel}`)
        } else {
          minThumb?.attr('aria-label', 'Minimum value')
          maxThumb?.attr('aria-label', 'Maximum value')
        }

        updateMinValue(minValue, false)
        updateMaxValue(maxValue, false)
      },

      onDisconnected() {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const priceRangeSlider = story({
  intent: 'Price range slider for filtering products by price',
  template: () => (
    <RangeSlider
      min='0'
      max='1000'
      min-value='100'
      max-value='500'
      step='10'
      aria-label='Price range'
      name='price'
    >
      <span slot='label'>Price Range</span>
    </RangeSlider>
  ),
  play: async ({ findByAttribute, assert }) => {
    const minThumb = await findByAttribute('data-thumb', 'min')
    const maxThumb = await findByAttribute('data-thumb', 'max')

    assert({
      given: 'range slider is rendered',
      should: 'have min thumb with correct initial value',
      actual: minThumb?.getAttribute('aria-valuenow'),
      expected: '100',
    })

    assert({
      given: 'range slider is rendered',
      should: 'have max thumb with correct initial value',
      actual: maxThumb?.getAttribute('aria-valuenow'),
      expected: '500',
    })
  },
})

export const defaultRangeSlider = story({
  intent: 'Range slider with default values',
  template: () => (
    <RangeSlider aria-label='Value range'>
      <span slot='label'>Select Range</span>
    </RangeSlider>
  ),
  play: async ({ findByAttribute, assert }) => {
    const minThumb = await findByAttribute('data-thumb', 'min')

    assert({
      given: 'range slider with defaults',
      should: 'use default min value of 20',
      actual: minThumb?.getAttribute('aria-valuenow'),
      expected: '20',
    })
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - multi-thumb sliders use Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`, `internals`
- **Requires external web API**: No - uses standard DOM APIs (mouse events)
- **Cleanup required**: Yes - mouse event listeners cleanup in `onDisconnected`

## Keyboard Interaction

Each thumb is in the page tab sequence and has the keyboard interactions described in the Slider Pattern:

- **ArrowRight/ArrowUp**: Increase value by one step
- **ArrowLeft/ArrowDown**: Decrease value by one step
- **Home**: Set to minimum allowed value
- **End**: Set to maximum allowed value
- **PageUp** (Optional): Increase by larger step
- **PageDown** (Optional): Decrease by larger step

**Important**: The tab order remains constant regardless of thumb value and visual position within the slider.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="slider"**: Each focusable slider thumb
- **aria-valuenow**: Current value of each slider (decimal)
- **aria-valuemin**: Minimum allowed value for each slider (may be dynamic)
- **aria-valuemax**: Maximum allowed value for each slider (may be dynamic)

### Optional

- **aria-valuetext**: Human-readable text alternative for each slider
- **aria-label** or **aria-labelledby**: Accessible name for each slider
- **aria-orientation**: `vertical` for vertical slider (default: `horizontal`)
- **role="group"**: Container for related sliders (optional)

## Best Practices

1. **Use bElement** - Multi-thumb sliders require complex state coordination
2. **Use FunctionalTemplates** for static display only
3. **Use spread syntax** - `{...styles.x}` for applying styles
4. **Tab order** - Keep tab order constant regardless of visual position
5. **Constraints** - Implement proper min/max constraints between thumbs
6. **Use `$()` with `p-target`** - never use `querySelector` directly
7. **Form association** - Use FormData for multiple values

## Accessibility Considerations

- Screen readers announce each thumb's value and constraints
- Keyboard users can adjust each value independently
- Focus indicators must be visible on the active thumb
- Tab order remains constant for predictable navigation
- Dynamic constraints are announced when values change

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Slider (Multi-Thumb) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/)
- Related: [Slider Pattern](./aria-slider-pattern.md) - Single-thumb slider implementation
- MDN: [ARIA slider role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/slider_role)
