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

**Important Warning**: Some users of touch-based assistive technologies may experience difficulty utilizing widgets that implement this slider pattern because the gestures their assistive technology provides for operating sliders may not yet generate the necessary output. Authors should fully test slider widgets using assistive technologies on devices where touch is a primary input mechanism before considering incorporation into production systems.

**Note**: Use native HTML `<input type="range">` when possible, as it provides built-in semantics, keyboard support, and touch handling.

## Use Cases

- Volume controls
- Brightness/contrast settings
- Temperature controls
- Color picker components (RGB, HSL)
- Media seek controls (video/audio)
- Rating scales
- Price range filters
- Zoom controls
- Progress indicators (when user can control)

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

<!-- Vertical slider -->
<div 
  role="slider"
  aria-valuenow="75"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-orientation="vertical"
  aria-label="Temperature"
  tabindex="0"
>
  <div class="track-vertical">
    <div class="thumb" style="inset-block-end: 75%"></div>
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
    case 'PageUp':
      e.preventDefault()
      newValue = Math.min(max, currentValue + (step * 10))
      break
    case 'PageDown':
      e.preventDefault()
      newValue = Math.max(min, currentValue - (step * 10))
      break
  }
  
  if (newValue !== currentValue) {
    slider.setAttribute('aria-valuenow', newValue)
    updateSliderVisual(newValue, min, max)
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, sliders can be implemented as:
1. **bElements wrapping native `<input type="range">`** (preferred for form association)
2. **bElements with custom ARIA slider** (for advanced styling/behavior)
3. **Functional Templates** for static slider displays

#### Native Range Input Wrapper (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const sliderStyles = createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  input: {
    inlineSize: '100%',
    blockSize: '8px',
    borderRadius: '4px',
    outline: 'none',
    // Webkit styling
    '&::-webkit-slider-thumb': {
      appearance: 'none',
      inlineSize: '20px',
      blockSize: '20px',
      borderRadius: '50%',
      backgroundColor: '#007bff',
      cursor: 'pointer',
    },
    '&::-webkit-slider-runnable-track': {
      blockSize: '8px',
      borderRadius: '4px',
      backgroundColor: '#e0e0e0',
    },
    // Firefox styling
    '&::-moz-range-thumb': {
      inlineSize: '20px',
      blockSize: '20px',
      borderRadius: '50%',
      backgroundColor: '#007bff',
      cursor: 'pointer',
      border: 'none',
    },
    '&::-moz-range-track': {
      blockSize: '8px',
      borderRadius: '4px',
      backgroundColor: '#e0e0e0',
    },
  },
  label: {
    fontSize: '0.875em',
    color: '#666',
  },
  value: {
    fontSize: '0.875em',
    fontWeight: 'bold',
  },
})

type SliderEvents = {
  input: { value: number }
  change: { value: number }
}

export const Slider = bElement<SliderEvents>({
  tag: 'accessible-slider',
  observedAttributes: ['value', 'min', 'max', 'step', 'aria-label', 'aria-orientation'],
  formAssociated: true,
  shadowDom: (
    <div {...sliderStyles.container}>
      <label p-target='label' {...sliderStyles.label}>
        <slot name='label'></slot>
      </label>
      <input
        p-target='input'
        type='range'
        {...sliderStyles.input}
        p-trigger={{ input: 'handleInput', change: 'handleChange' }}
      />
      <div p-target='value' {...sliderStyles.value}></div>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const input = $<HTMLInputElement>('input')[0]
    const valueDisplay = $('value')[0]
    
    let currentValue = 50
    let min = 0
    let max = 100
    let step = 1
    
    const updateValue = (newValue: number, updateInput = true) => {
      currentValue = Math.max(min, Math.min(max, newValue))
      
      if (updateInput && input) {
        input.value = String(currentValue)
      }
      
      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))
      
      // Update value display
      valueDisplay?.render(String(currentValue))
      
      // Update ARIA attributes
      input?.setAttribute('aria-valuenow', String(currentValue))
      input?.setAttribute('aria-valuemin', String(min))
      input?.setAttribute('aria-valuemax', String(max))
    }
    
    return {
      handleInput(event: { target: HTMLInputElement }) {
        const newValue = Number(event.target.value)
        updateValue(newValue, false)
        emit({ type: 'input', detail: { value: currentValue } })
      },
      
      handleChange(event: { target: HTMLInputElement }) {
        const newValue = Number(event.target.value)
        updateValue(newValue, false)
        emit({ type: 'change', detail: { value: currentValue } })
      },
      
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')
        const orientation = host.getAttribute('aria-orientation')
        
        if (minAttr) {
          min = Number(minAttr)
          input?.setAttribute('min', String(min))
        }
        if (maxAttr) {
          max = Number(maxAttr)
          input?.setAttribute('max', String(max))
        }
        if (stepAttr) {
          step = Number(stepAttr)
          input?.setAttribute('step', String(step))
        }
        if (valueAttr) {
          updateValue(Number(valueAttr))
        } else {
          updateValue(min)
        }
        if (ariaLabel) {
          input?.setAttribute('aria-label', ariaLabel)
        }
        if (orientation === 'vertical') {
          input?.setAttribute('aria-orientation', 'vertical')
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateValue(Number(newValue))
        } else if (name === 'min' && newValue) {
          min = Number(newValue)
          input?.setAttribute('min', newValue)
          updateValue(currentValue)
        } else if (name === 'max' && newValue) {
          max = Number(newValue)
          input?.setAttribute('max', newValue)
          updateValue(currentValue)
        } else if (name === 'step' && newValue) {
          step = Number(newValue)
          input?.setAttribute('step', newValue)
        } else if (name === 'aria-label') {
          input?.setAttribute('aria-label', newValue || 'Slider')
        } else if (name === 'aria-orientation') {
          input?.setAttribute('aria-orientation', newValue || 'horizontal')
        }
      },
    }
  },
})
```

#### Custom ARIA Slider (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const customSliderStyles = createStyles({
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
    transition: 'inlineSize 0.1s ease',
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
    transition: {
      $default: 'transform 0.1s ease',
      ':active': 'transform 0.1s ease, scale(1.2)',
    },
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
})

type CustomSliderEvents = {
  input: { value: number }
  change: { value: number }
}

export const CustomSlider = bElement<CustomSliderEvents>({
  tag: 'custom-slider',
  observedAttributes: ['value', 'min', 'max', 'step', 'aria-label', 'aria-orientation', 'aria-valuetext'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='slider'
      role='slider'
      tabIndex={0}
      {...customSliderStyles.slider}
      p-trigger={{ keydown: 'handleKeydown', mousedown: 'handleMouseDown', click: 'handleClick' }}
    >
      <div
        p-target='track'
        {...customSliderStyles.track}
        aria-hidden='true'
      >
        <div p-target='fill' {...customSliderStyles.fill}></div>
        <div p-target='thumb' {...customSliderStyles.thumb}></div>
      </div>
      <div p-target='value' {...customSliderStyles.value}></div>
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const slider = $('slider')[0]
    const track = $('track')[0]
    const fill = $('fill')[0]
    const thumb = $('thumb')[0]
    const valueDisplay = $('value')[0]
    
    let currentValue = 50
    let min = 0
    let max = 100
    let step = 1
    let isDragging = false
    let isVertical = false
    
    const getPercentage = (value: number): number => {
      return ((value - min) / (max - min)) * 100
    }
    
    const getValueFromPosition = (clientX: number, clientY: number): number => {
      const rect = track?.getBoundingClientRect()
      if (!rect) return currentValue
      
      let percentage: number
      if (isVertical) {
        const y = clientY - rect.top
        percentage = 100 - (y / rect.height) * 100
      } else {
        const x = clientX - rect.left
        percentage = (x / rect.width) * 100
      }
      
      percentage = Math.max(0, Math.min(100, percentage))
      const rawValue = min + (percentage / 100) * (max - min)
      
      // Snap to step
      return Math.round(rawValue / step) * step
    }
    
    const updateValue = (newValue: number, emitEvent = true) => {
      currentValue = Math.max(min, Math.min(max, newValue))
      const percentage = getPercentage(currentValue)
      
      // Update visual position
      if (isVertical) {
        thumb?.setAttribute('style', `inset-block-end: ${percentage}%`)
        fill?.setAttribute('style', `block-size: ${percentage}%`)
      } else {
        thumb?.setAttribute('style', `inset-inline-start: ${percentage}%`)
        fill?.setAttribute('style', `inline-size: ${percentage}%`)
      }
      
      // Update ARIA attributes
      slider?.setAttribute('aria-valuenow', String(currentValue))
      slider?.setAttribute('aria-valuemin', String(min))
      slider?.setAttribute('aria-valuemax', String(max))
      
      // Update value display
      const valueText = host.getAttribute('aria-valuetext') || String(currentValue)
      valueDisplay?.render(valueText)
      
      // Update form value
      host.setAttribute('value', String(currentValue))
      internals.setFormValue(String(currentValue))
      
      if (emitEvent) {
        emit({ type: 'input', detail: { value: currentValue } })
      }
    }
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return
      const newValue = getValueFromPosition(event.clientX, event.clientY)
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
            newValue = Math.min(max, currentValue + (step * 10))
            break
            
          case 'PageDown':
            event.preventDefault()
            newValue = Math.max(min, currentValue - (step * 10))
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
        const newValue = getValueFromPosition(event.clientX, event.clientY)
        updateValue(newValue)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      },
      
      handleClick(event: MouseEvent) {
        if (!isDragging) {
          const newValue = getValueFromPosition(event.clientX, event.clientY)
          updateValue(newValue)
          emit({ type: 'change', detail: { value: currentValue } })
        }
      },
      
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const stepAttr = host.getAttribute('step')
        const ariaLabel = host.getAttribute('aria-label')
        const orientation = host.getAttribute('aria-orientation')
        
        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (stepAttr) step = Number(stepAttr)
        if (valueAttr) {
          updateValue(Number(valueAttr), false)
        } else {
          updateValue(min, false)
        }
        if (ariaLabel) {
          slider?.setAttribute('aria-label', ariaLabel)
        }
        if (orientation === 'vertical') {
          isVertical = true
          slider?.setAttribute('aria-orientation', 'vertical')
          // Adjust styles for vertical
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
        } else if (name === 'aria-label') {
          slider?.setAttribute('aria-label', newValue || 'Slider')
        } else if (name === 'aria-orientation') {
          isVertical = newValue === 'vertical'
          slider?.setAttribute('aria-orientation', newValue || 'horizontal')
        } else if (name === 'aria-valuetext') {
          slider?.setAttribute('aria-valuetext', newValue || '')
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

#### Vertical Slider

```typescript
export const VerticalSlider = bElement<CustomSliderEvents>({
  tag: 'vertical-slider',
  observedAttributes: ['value', 'min', 'max', 'step', 'aria-label'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='slider'
      role='slider'
      aria-orientation='vertical'
      tabIndex={0}
      {...customSliderStyles.slider}
      style={{ flexDirection: 'column', blockSize: '200px', inlineSize: '40px' }}
      p-trigger={{ keydown: 'handleKeydown', mousedown: 'handleMouseDown' }}
    >
      {/* Similar structure but vertical */}
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    // Similar to CustomSlider but with vertical orientation
    // ...
  },
})
```

#### Temperature Slider Example

```typescript
export const TemperatureSlider = bElement<CustomSliderEvents>({
  tag: 'temperature-slider',
  observedAttributes: ['value', 'min', 'max', 'step'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='slider'
      role='slider'
      aria-orientation='vertical'
      aria-label='Temperature'
      tabIndex={0}
      {...customSliderStyles.slider}
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      {/* Slider structure */}
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const slider = $('slider')[0]
    let currentValue = 20 // Celsius
    
    const updateValue = (newValue: number) => {
      currentValue = newValue
      const fahrenheit = (newValue * 9/5) + 32
      const valueText = `${newValue}°C (${fahrenheit}°F)`
      
      slider?.setAttribute('aria-valuenow', String(newValue))
      slider?.setAttribute('aria-valuetext', valueText)
      // ... update visual
    }
    
    // ... rest of implementation
  },
})
```

#### Media Seek Slider Example

```typescript
export const MediaSeekSlider = bElement<CustomSliderEvents>({
  tag: 'media-seek-slider',
  observedAttributes: ['value', 'max'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='slider'
      role='slider'
      aria-label='Media position'
      tabIndex={0}
      {...customSliderStyles.slider}
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      {/* Slider structure */}
    </div>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const slider = $('slider')[0]
    let currentTime = 0 // seconds
    let maxTime = 0 // seconds
    
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    
    const updateValue = (newTime: number) => {
      currentTime = newTime
      const maxFormatted = formatTime(maxTime)
      const currentFormatted = formatTime(currentTime)
      const valueText = `${currentFormatted} of ${maxFormatted}`
      
      slider?.setAttribute('aria-valuenow', String(currentTime))
      slider?.setAttribute('aria-valuemax', String(maxTime))
      slider?.setAttribute('aria-valuetext', valueText)
      // ... update visual
    }
    
    // ... rest of implementation
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - sliders use Shadow DOM
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `render()` for updates
- **Requires external web API**: No - uses standard DOM APIs (mouse events)
- **Cleanup required**: Yes - mouse event listeners cleanup in `onDisconnected`

## Keyboard Interaction

- **ArrowRight/ArrowUp**: Increase value by one step
- **ArrowLeft/ArrowDown**: Decrease value by one step
- **Home**: Set to minimum value
- **End**: Set to maximum value
- **PageUp** (Optional): Increase by larger step (e.g., 10 steps)
- **PageDown** (Optional): Decrease by larger step (e.g., 10 steps)

**Note**: Focus is placed on the slider thumb. In some circumstances, reversing the direction of value change for arrow keys (e.g., Up Arrow decreasing value) could create a more intuitive experience.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="slider"**: The focusable slider control
- **aria-valuenow**: Current value (decimal)
- **aria-valuemin**: Minimum allowed value (decimal)
- **aria-valuemax**: Maximum allowed value (decimal)

### Optional

- **aria-valuetext**: Human-readable text alternative (e.g., "50% (6 hours) remaining", "Monday")
- **aria-label** or **aria-labelledby**: Accessible name for slider
- **aria-orientation**: `vertical` for vertical slider (default: `horizontal`)
- **aria-describedby**: References element providing additional description

### Native HTML `<input type="range">` Attributes

- **min**: Minimum value (default: 0)
- **max**: Maximum value (default: 100)
- **value**: Current value
- **step**: Step increment (default: 1)
- **list**: Reference to `<datalist>` for tick marks

## Best Practices

1. **Use native `<input type="range">`** - Prefer native element when possible
2. **bElement for custom** - Use bElement for advanced styling/behavior
3. **Keyboard support** - Implement all required keyboard interactions
4. **Mouse/touch support** - Handle drag interactions for mouse users
5. **Value text** - Use `aria-valuetext` for user-friendly descriptions
6. **Form association** - Use `formAssociated: true` for form integration
7. **Step values** - Support discrete steps or continuous values
8. **Visual feedback** - Clear indication of value and thumb position
9. **Touch testing** - Test with touch-based assistive technologies
10. **Orientation** - Support both horizontal and vertical orientations

## Accessibility Considerations

- Screen readers announce slider value and range
- Keyboard users can adjust value without mouse
- Focus indicators must be visible
- Value must be clearly indicated
- `aria-valuetext` provides context beyond numeric value
- Touch-based assistive technologies may have limitations
- Visual representation should match announced value
- Ensure sufficient color contrast

## Slider Variants

### Horizontal Slider
- Default orientation
- Left = min, Right = max
- Common for volume, brightness, etc.

### Vertical Slider
- `aria-orientation="vertical"`
- Bottom = min, Top = max
- Common for temperature, height controls

### Discrete Slider
- Uses step values
- Snaps to specific values
- Common for ratings, scales

### Continuous Slider
- No step constraints
- Smooth value changes
- Common for color pickers, precise controls

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<input type="range">`) |
| Firefox | Full support (native `<input type="range">`) |
| Safari | Full support (native `<input type="range">`) |
| Edge | Full support (native `<input type="range">`) |

**Note**: Native HTML `<input type="range">` has universal support in modern browsers. ARIA `role="slider"` also has universal support with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- MDN: [HTML input type="range"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range)
- MDN: [ARIA slider role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/slider_role)
- Related: [Meter Pattern](./aria-meter-pattern.md) - For displaying values (not user input)
