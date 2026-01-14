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
      <div class="thumb-min" style="left: 25%"></div>
      <div class="thumb-max" style="left: 75%"></div>
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

#### Two-Thumb Range Slider (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const rangeSliderStyles = createStyles({
  container: {
    position: 'relative',
    width: '100%',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
  },
  track: {
    position: 'relative',
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
  },
  fill: {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: '4px',
    transition: 'left 0.1s ease, width 0.1s ease',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    cursor: 'grab',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    zIndex: {
      $default: 2,
      '[data-focused="true"]': 3,
    },
    transition: {
      $default: 'transform 0.1s ease',
      ':active': 'transform 0.1s ease, scale(1.2)',
    },
  },
  label: {
    fontSize: '0.875em',
    color: '#666',
    marginBottom: '0.5rem',
  },
  value: {
    fontSize: '0.875em',
    fontWeight: 'bold',
    marginTop: '0.5rem',
  },
})

type RangeSliderEvents = {
  input: { min: number; max: number }
  change: { min: number; max: number }
}

export const RangeSlider = bElement<RangeSliderEvents>({
  tag: 'range-slider',
  observedAttributes: ['min', 'max', 'min-value', 'max-value', 'step', 'aria-label'],
  formAssociated: true,
  shadowDom: (
    <div {...rangeSliderStyles.container}>
      <div p-target='label' {...rangeSliderStyles.label}>
        <slot name='label'></slot>
      </div>
      <div
        p-target='track'
        {...rangeSliderStyles.track}
        aria-hidden='true'
        p-trigger={{ click: 'handleTrackClick' }}
      >
        <div p-target='fill' {...rangeSliderStyles.fill}></div>
        <div
          p-target='min-thumb'
          role='slider'
          data-thumb='min'
          tabIndex={0}
          {...rangeSliderStyles.thumb}
          p-trigger={{ keydown: 'handleMinKeydown', mousedown: 'handleMinMouseDown', focus: 'handleMinFocus', blur: 'handleMinBlur' }}
        ></div>
        <div
          p-target='max-thumb'
          role='slider'
          data-thumb='max'
          tabIndex={0}
          {...rangeSliderStyles.thumb}
          p-trigger={{ keydown: 'handleMaxKeydown', mousedown: 'handleMaxMouseDown', focus: 'handleMaxFocus', blur: 'handleMaxBlur' }}
        ></div>
      </div>
      <div p-target='value' {...rangeSliderStyles.value}></div>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
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
      
      // Snap to step
      return Math.round(rawValue / step) * step
    }
    
    const updateMinValue = (newValue: number, emitEvent = true) => {
      // Constraint: min cannot exceed max - step
      minValue = Math.max(absoluteMin, Math.min(maxValue - step, newValue))
      const percentage = getPercentage(minValue)
      
      minThumb?.setAttribute('style', `left: ${percentage}%`)
      minThumb?.setAttribute('aria-valuenow', String(minValue))
      minThumb?.setAttribute('aria-valuemin', String(absoluteMin))
      minThumb?.setAttribute('aria-valuemax', String(maxValue - step))
      
      // Update fill position
      const minPercent = getPercentage(minValue)
      const maxPercent = getPercentage(maxValue)
      fill?.setAttribute('style', `left: ${minPercent}%; width: ${maxPercent - minPercent}%`)
      
      updateFormValue()
      updateValueDisplay()
      
      if (emitEvent) {
        emit({ type: 'input', detail: { min: minValue, max: maxValue } })
      }
    }
    
    const updateMaxValue = (newValue: number, emitEvent = true) => {
      // Constraint: max cannot be less than min + step
      maxValue = Math.min(absoluteMax, Math.max(minValue + step, newValue))
      const percentage = getPercentage(maxValue)
      
      maxThumb?.setAttribute('style', `left: ${percentage}%`)
      maxThumb?.setAttribute('aria-valuenow', String(maxValue))
      maxThumb?.setAttribute('aria-valuemin', String(minValue + step))
      maxThumb?.setAttribute('aria-valuemax', String(absoluteMax))
      
      // Update fill position
      const minPercent = getPercentage(minValue)
      const maxPercent = getPercentage(maxValue)
      fill?.setAttribute('style', `left: ${minPercent}%; width: ${maxPercent - minPercent}%`)
      
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
            
          case 'PageUp':
            event.preventDefault()
            newValue = Math.min(maxValue - step, minValue + (step * 10))
            break
            
          case 'PageDown':
            event.preventDefault()
            newValue = Math.max(absoluteMin, minValue - (step * 10))
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
            
          case 'PageUp':
            event.preventDefault()
            newValue = Math.min(absoluteMax, maxValue + (step * 10))
            break
            
          case 'PageDown':
            event.preventDefault()
            newValue = Math.max(minValue + step, maxValue - (step * 10))
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
        const newValue = getValueFromPosition(event.clientX)
        updateMinValue(newValue)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },
      
      handleMaxMouseDown(event: MouseEvent) {
        event.preventDefault()
        isDragging = true
        draggingThumb = 'max'
        const newValue = getValueFromPosition(event.clientX)
        updateMaxValue(newValue)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },
      
      handleTrackClick(event: MouseEvent) {
        if (isDragging) return
        
        const newValue = getValueFromPosition(event.clientX)
        const minPercent = getPercentage(minValue)
        const maxPercent = getPercentage(maxValue)
        const clickPercent = getPercentage(newValue)
        
        // Determine which thumb to move (closest one)
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
        minThumb?.setAttribute('data-focused', 'true')
        maxThumb?.setAttribute('data-focused', 'false')
      },
      
      handleMaxFocus() {
        maxThumb?.setAttribute('data-focused', 'true')
        minThumb?.setAttribute('data-focused', 'false')
      },
      
      handleMinBlur() {
        minThumb?.removeAttribute('data-focused')
      },
      
      handleMaxBlur() {
        maxThumb?.removeAttribute('data-focused')
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
        
        // Ensure constraints
        minValue = Math.max(absoluteMin, Math.min(maxValue - step, minValue))
        maxValue = Math.min(absoluteMax, Math.max(minValue + step, maxValue))
        
        // Set ARIA labels
        if (ariaLabel) {
          minThumb?.setAttribute('aria-label', `Minimum ${ariaLabel}`)
          maxThumb?.setAttribute('aria-label', `Maximum ${ariaLabel}`)
        } else {
          minThumb?.setAttribute('aria-label', 'Minimum value')
          maxThumb?.setAttribute('aria-label', 'Maximum value')
        }
        
        // Initialize visual state
        updateMinValue(minValue, false)
        updateMaxValue(maxValue, false)
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'min' && newValue) {
          absoluteMin = Number(newValue)
          updateMinValue(minValue)
        } else if (name === 'max' && newValue) {
          absoluteMax = Number(newValue)
          updateMaxValue(maxValue)
        } else if (name === 'min-value' && newValue) {
          updateMinValue(Number(newValue))
        } else if (name === 'max-value' && newValue) {
          updateMaxValue(Number(newValue))
        } else if (name === 'step' && newValue) {
          step = Number(newValue)
        } else if (name === 'aria-label') {
          minThumb?.setAttribute('aria-label', `Minimum ${newValue || 'value'}`)
          maxThumb?.setAttribute('aria-label', `Maximum ${newValue || 'value'}`)
        }
      },
      
      onDisconnected() {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      },
    }
  },
})
```

#### Price Range Slider Example

```typescript
export const priceRangeSlider = story({
  intent: 'Price range slider for filtering',
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
})
```

#### Independent Multi-Thumb Slider

```typescript
export const IndependentMultiSlider = bElement<{
  input: { values: number[] }
  change: { values: number[] }
}>({
  tag: 'independent-multi-slider',
  observedAttributes: ['values', 'min', 'max', 'step'],
  formAssociated: true,
  shadowDom: (
    <div p-target='container' {...rangeSliderStyles.container}>
      <div
        p-target='track'
        {...rangeSliderStyles.track}
        aria-hidden='true'
      >
        <slot name='thumbs'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const track = $('track')[0]
    let values: number[] = []
    let absoluteMin = 0
    let absoluteMax = 100
    let step = 1
    let thumbs: HTMLElement[] = []
    
    const getThumbs = (): HTMLElement[] => {
      return Array.from(
        root.querySelectorAll('[role="slider"]')
      ) as HTMLElement[]
    }
    
    const updateThumb = (index: number, newValue: number) => {
      if (index < 0 || index >= values.length) return
      
      values[index] = Math.max(absoluteMin, Math.min(absoluteMax, newValue))
      const thumb = thumbs[index]
      const percentage = ((values[index] - absoluteMin) / (absoluteMax - absoluteMin)) * 100
      
      thumb?.setAttribute('style', `left: ${percentage}%`)
      thumb?.setAttribute('aria-valuenow', String(values[index]))
      thumb?.setAttribute('aria-valuemin', String(absoluteMin))
      thumb?.setAttribute('aria-valuemax', String(absoluteMax))
      
      updateFormValue()
      emit({ type: 'input', detail: { values: [...values] } })
    }
    
    const updateFormValue = () => {
      const formData = new FormData()
      const name = host.getAttribute('name') || 'values'
      
      values.forEach((value, index) => {
        formData.append(`${name}[${index}]`, String(value))
      })
      
      internals.setFormValue(formData)
    }
    
    return {
      // Keyboard handlers for each thumb (similar to RangeSlider)
      // Mouse handlers for each thumb
      // ...
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - multi-thumb sliders use Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `render()` for updates
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

**Important**: The tab order remains constant regardless of thumb value and visual position within the slider. For example, if the value of a thumb changes such that it moves past one of the other thumbs, the tab order does not change.

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

### Dynamic Constraints

When the range of one slider is dependent on the current value of another slider:
- Update `aria-valuemin` or `aria-valuemax` of dependent sliders when values change
- Example: In a range slider, min thumb's `aria-valuemax` = max thumb's `aria-valuenow - step`
- Example: In a range slider, max thumb's `aria-valuemin` = min thumb's `aria-valuenow + step`

## Best Practices

1. **Use bElement** - Multi-thumb sliders require complex state coordination
2. **Tab order** - Keep tab order constant regardless of visual position
3. **Constraints** - Implement proper min/max constraints between thumbs
4. **Form association** - Use FormData for multiple values
5. **Keyboard support** - Each thumb must have full keyboard support
6. **Visual feedback** - Clear indication of which thumb is focused
7. **Value text** - Use `aria-valuetext` for user-friendly descriptions
8. **Labels** - Provide distinct labels for each thumb
9. **Touch testing** - Test with touch-based assistive technologies
10. **Fill visualization** - Show range between thumbs (for range sliders)

## Accessibility Considerations

- Screen readers announce each thumb's value and constraints
- Keyboard users can adjust each value independently
- Focus indicators must be visible on the active thumb
- Tab order remains constant for predictable navigation
- Dynamic constraints are announced when values change
- Touch-based assistive technologies may have limitations
- Visual representation should match announced values
- Ensure sufficient color contrast for thumbs and track

## Multi-Thumb Slider Variants

### Range Slider (Two Thumbs)
- Min/max value selection
- Thumbs cannot pass each other
- Common for price, date, size ranges
- Fill shows selected range

### Independent Multi-Thumb
- Each thumb sets independent value
- Thumbs can pass each other
- Common for multi-parameter controls
- No fill visualization

### Dependent Multi-Thumb
- Values depend on other thumbs
- Complex constraint relationships
- Common for advanced filters
- Dynamic min/max updates

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA multi-thumb slider pattern has universal support in modern browsers with assistive technology. However, touch-based assistive technologies may have limitations.

## References

- Source: [W3C ARIA Authoring Practices Guide - Slider (Multi-Thumb) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/)
- Related: [Slider Pattern](./aria-slider-pattern.md) - Single-thumb slider implementation
- MDN: [ARIA slider role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/slider_role)
- Related: [Form-Associated Elements](../plaited-ui-patterns/references/form-associated-elements.md) - FormData usage
