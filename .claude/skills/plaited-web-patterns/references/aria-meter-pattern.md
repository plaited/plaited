# ARIA Meter Pattern

## Overview

A meter is a graphical display of a numeric value that varies within a defined range. For example, a meter could be used to depict a device's current battery percentage or a car's fuel level.

**Key Characteristics:**
- **Value display**: Shows numeric value within defined range
- **No keyboard interaction**: Meters are presentational only
- **Range-based**: Has minimum and maximum values
- **Visual representation**: Typically displayed as a bar or gauge
- **ARIA attributes**: `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` (optional)

**Important Notes:**
- A `meter` should **not** be used to represent a value like the current world population since it does not have a meaningful maximum limit.
- The `meter` should **not** be used to indicate progress, such as loading or percent completion of a task. To communicate progress, use the `progressbar` role instead.
- Use native HTML `<meter>` element when possible, as it provides built-in semantics and styling.

## Use Cases

- Battery level indicators
- Fuel level displays
- Disk space usage
- Memory usage indicators
- Temperature gauges
- Volume level indicators
- Storage capacity displays
- Performance metrics (CPU, network)

## Implementation

### Vanilla JavaScript

```html
<!-- Native HTML meter element -->
<meter 
  min="0" 
  max="100" 
  value="75"
  aria-label="Battery level"
>
  75%
</meter>

<!-- ARIA meter (when native element can't be used) -->
<div 
  role="meter"
  aria-valuenow="75"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Battery level"
>
  <div style="inline-size: 75%; background: green;">75%</div>
</div>

<!-- Meter with custom text -->
<meter 
  min="0" 
  max="100" 
  value="50"
  aria-valuetext="50% (6 hours) remaining"
  aria-label="Battery level"
>
  50%
</meter>
```

```javascript
// Update meter value
function updateMeter(meter, newValue) {
  meter.setAttribute('value', newValue)
  meter.setAttribute('aria-valuenow', newValue)
  
  // Update visual representation
  const fill = meter.querySelector('.meter-fill')
  const percentage = ((newValue - meter.min) / (meter.max - meter.min)) * 100
  fill.style.width = `${percentage}%`
}
```

### Plaited Adaptation

**Important**: In Plaited, meters can be implemented as:
1. **Functional Templates (FT)** for static meters in stories
2. **bElements** for dynamic meters that need to update from external sources
3. **Native `<meter>` element** when possible (preferred)

#### Static Meter (Functional Template)

```typescript
// meter.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { meterStyles } from './meter.css.ts'

const Meter: FT<{
  value: number
  min?: number
  max?: number
  'aria-label'?: string
  'aria-valuetext'?: string
  children?: Children
}> = ({
  value,
  min = 0,
  max = 100,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  children,
  ...attrs
}) => (
  <meter
    min={min}
    max={max}
    value={value}
    aria-label={ariaLabel}
    aria-valuetext={ariaValueText}
    {...attrs}
    {...joinStyles(meterStyles.meter)}
  >
    {children || `${value}%`}
  </meter>
)

export const batteryMeter = story({
  intent: 'Battery level meter',
  template: () => (
    <Meter value={75} min={0} max={100} aria-label='Battery level'>
      75%
    </Meter>
  ),
})
```

#### Custom Meter (Functional Template)

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { meterStyles } from './meter.css.ts'

const CustomMeter: FT<{
  'aria-valuenow': number
  'aria-valuemin': number
  'aria-valuemax': number
  'aria-label'?: string
  'aria-valuetext'?: string
  children?: Children
}> = ({
  'aria-valuenow': ariaValueNow,
  'aria-valuemin': ariaValueMin,
  'aria-valuemax': ariaValueMax,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  children,
  ...attrs
}) => {
  const percentage = ((ariaValueNow - ariaValueMin) / (ariaValueMax - ariaValueMin)) * 100
  
  return (
    <div
      role='meter'
      aria-valuenow={ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      {...attrs}
      {...joinStyles(meterStyles.meter)}
    >
      <div
        {...meterStyles.track}
        aria-hidden='true'
      >
        <div
          {...meterStyles.fill}
          style={{ inlineSize: `${percentage}%` }}
        ></div>
      </div>
      {children && <div {...meterStyles.label}>{children}</div>}
    </div>
  )
}

export const customMeter = story({
  intent: 'Custom styled meter',
  template: () => (
    <CustomMeter
      aria-valuenow={60}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label='Disk usage'
    >
      60% used
    </CustomMeter>
  ),
})
```

#### Dynamic Meter (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const meterStyles = createStyles({
  meter: {
    inlineSize: '100%',
    blockSize: '20px',
    position: 'relative',
  },
  track: {
    inlineSize: '100%',
    blockSize: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  fill: {
    blockSize: '100%',
    backgroundColor: {
      $default: '#4caf50',
      '[data-low="true"]': '#ff9800',
      '[data-high="true"]': '#f44336',
    },
    transition: 'inline-size 0.3s ease, background-color 0.3s ease',
  },
  label: {
    position: 'absolute',
    insetBlockStart: '50%',
    insetInlineStart: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '0.875em',
    fontWeight: 'bold',
    color: '#333',
  },
})

type MeterEvents = {
  update: { value: number; percentage: number }
}

export const DynamicMeter = bElement<MeterEvents>({
  tag: 'dynamic-meter',
  observedAttributes: ['value', 'min', 'max', 'aria-label', 'aria-valuetext'],
  shadowDom: (
    <div p-target='meter' role='meter' {...meterStyles.meter}>
      <div p-target='track' {...meterStyles.track} aria-hidden='true'>
        <div p-target='fill' {...meterStyles.fill}></div>
      </div>
      <div p-target='label' {...meterStyles.label}></div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const meter = $('meter')[0]
    const fill = $('fill')[0]
    const label = $('label')[0]
    
    let currentValue = 0
    let min = 0
    let max = 100
    
    const updateMeter = (value: number) => {
      currentValue = Math.max(min, Math.min(max, value)) // Clamp value
      const percentage = ((currentValue - min) / (max - min)) * 100
      
      meter?.attr('aria-valuenow', String(currentValue))
      meter?.attr('aria-valuemin', String(min))
      meter?.attr('aria-valuemax', String(max))
      
      fill?.attr('style', `inline-size: ${percentage}%`)
      
      // Update color based on thresholds (optional)
      if (percentage < 25) {
        fill?.setAttribute('data-low', 'true')
        fill?.removeAttribute('data-high')
      } else if (percentage > 75) {
        fill?.setAttribute('data-high', 'true')
        fill?.removeAttribute('data-low')
      } else {
        fill?.removeAttribute('data-low')
        fill?.removeAttribute('data-high')
      }
      
      // Update label
      const labelText = `${Math.round(percentage)}%`
      label?.render(labelText)
      
      emit({ type: 'update', detail: { value: currentValue, percentage } })
    }
    
    return {
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        
        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (valueAttr) {
          updateMeter(Number(valueAttr))
        } else {
          updateMeter(min)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateMeter(Number(newValue))
        } else if (name === 'min' && newValue) {
          min = Number(newValue)
          updateMeter(currentValue)
        } else if (name === 'max' && newValue) {
          max = Number(newValue)
          updateMeter(currentValue)
        } else if (name === 'aria-label') {
          meter?.attr('aria-label', newValue || null)
        } else if (name === 'aria-valuetext') {
          meter?.attr('aria-valuetext', newValue || null)
        }
      },
    }
  },
})
```

#### Battery Meter Example

```typescript
export const batteryMeter = story({
  intent: 'Battery level meter with custom text',
  template: () => (
    <DynamicMeter
      value={50}
      min={0}
      max={100}
      aria-label='Battery level'
      aria-valuetext='50% (6 hours) remaining'
    />
  ),
})
```

#### Fuel Level Meter Example

```typescript
export const fuelMeter = story({
  intent: 'Fuel level meter',
  template: () => (
    <DynamicMeter
      value={30}
      min={0}
      max={100}
      aria-label='Fuel level'
      aria-valuetext='30% remaining'
    />
  ),
})
```

#### Disk Usage Meter Example

```typescript
export const diskUsageMeter = story({
  intent: 'Disk usage meter',
  template: () => (
    <DynamicMeter
      value={85}
      min={0}
      max={100}
      aria-label='Disk usage'
      aria-valuetext='85% used (170 GB of 200 GB)'
    />
  ),
})
```

#### Meter Styling Example

```typescript
// meter.css.ts
import { createStyles } from 'plaited/ui'

export const meterStyles = createStyles({
  meter: {
    inlineSize: '100%',
    blockSize: '20px',
    borderRadius: '10px',
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    // Native meter styling
    '&::-webkit-meter-bar': {
      backgroundColor: '#e0e0e0',
    },
    '&::-webkit-meter-optimum-value': {
      backgroundColor: '#4caf50',
    },
    '&::-webkit-meter-suboptimum-value': {
      backgroundColor: '#ff9800',
    },
    '&::-webkit-meter-even-less-good-value': {
      backgroundColor: '#f44336',
    },
    // Firefox meter styling
    '&::-moz-meter-bar': {
      backgroundColor: '#4caf50',
    },
  },
  track: {
    inlineSize: '100%',
    blockSize: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
    position: 'relative',
    overflow: 'hidden',
  },
  fill: {
    blockSize: '100%',
    backgroundColor: '#4caf50',
    transition: 'inline-size 0.3s ease',
    borderRadius: '10px',
  },
  label: {
    position: 'absolute',
    insetBlockStart: '50%',
    insetInlineStart: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '0.875em',
    fontWeight: 'bold',
    color: '#333',
    pointerEvents: 'none',
  },
})
```

#### Meter with Color Zones

```typescript
export const MeterWithZones = bElement<MeterEvents>({
  tag: 'meter-with-zones',
  observedAttributes: ['value', 'min', 'max', 'low-threshold', 'high-threshold'],
  shadowDom: (
    <div p-target='meter' role='meter' {...meterStyles.meter}>
      <div p-target='track' {...meterStyles.track} aria-hidden='true'>
        <div p-target='fill' {...meterStyles.fill}></div>
      </div>
      <div p-target='label' {...meterStyles.label}></div>
    </div>
  ),
  bProgram({ $, host }) {
    const meter = $('meter')[0]
    const fill = $('fill')[0]
    const label = $('label')[0]
    
    let currentValue = 0
    let min = 0
    let max = 100
    let lowThreshold = 25
    let highThreshold = 75
    
    const updateMeter = (value: number) => {
      currentValue = Math.max(min, Math.min(max, value))
      const percentage = ((currentValue - min) / (max - min)) * 100
      
      meter?.attr('aria-valuenow', String(currentValue))
      fill?.attr('style', `inline-size: ${percentage}%`)
      
      // Color zones
      if (percentage < lowThreshold) {
        fill?.setAttribute('data-zone', 'low')
      } else if (percentage > highThreshold) {
        fill?.setAttribute('data-zone', 'high')
      } else {
        fill?.setAttribute('data-zone', 'medium')
      }
      
      label?.render(`${Math.round(percentage)}%`)
    }
    
    return {
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const lowAttr = host.getAttribute('low-threshold')
        const highAttr = host.getAttribute('high-threshold')
        
        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (lowAttr) lowThreshold = Number(lowAttr)
        if (highAttr) highThreshold = Number(highAttr)
        if (valueAttr) {
          updateMeter(Number(valueAttr))
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'value' && newValue) {
          updateMeter(Number(newValue))
        } else if (name === 'min' && newValue) {
          min = Number(newValue)
          updateMeter(currentValue)
        } else if (name === 'max' && newValue) {
          max = Number(newValue)
          updateMeter(currentValue)
        } else if (name === 'low-threshold' && newValue) {
          lowThreshold = Number(newValue)
          updateMeter(currentValue)
        } else if (name === 'high-threshold' && newValue) {
          highThreshold = Number(newValue)
          updateMeter(currentValue)
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - meters can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `attr()` for attributes, `render()` for updates
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

**Not applicable** - Meters are presentational elements and do not receive keyboard focus or interaction.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="meter"**: Container element (or use native `<meter>`)
- **aria-valuenow**: Current value (decimal between min and max)
- **aria-valuemin**: Minimum value (must be less than max)
- **aria-valuemax**: Maximum value (must be greater than min)

### Optional

- **aria-valuetext**: Human-readable text alternative (e.g., "50% (6 hours) remaining")
- **aria-label** or **aria-labelledby**: Accessible name for meter

### Native HTML `<meter>` Attributes

- **min**: Minimum value (default: 0)
- **max**: Maximum value (default: 1)
- **value**: Current value
- **low**: Low threshold (optional)
- **high**: High threshold (optional)
- **optimum**: Optimum value (optional)

## Best Practices

1. **Use native `<meter>`** - Prefer native element when possible
2. **Functional Templates** - Use FT for static meters in stories
3. **bElement for dynamic** - Use bElement when value updates from external sources
4. **Meaningful ranges** - Ensure min/max represent meaningful limits
5. **Custom text** - Use `aria-valuetext` for better context (e.g., "50% (6 hours)")
6. **Visual feedback** - Use color zones to indicate thresholds
7. **Accessible labels** - Always provide `aria-label` or `aria-labelledby`
8. **Don't use for progress** - Use `progressbar` role for task completion
9. **Don't use for unbounded values** - Meter requires meaningful maximum
10. **Smooth transitions** - Animate value changes for better UX

## Accessibility Considerations

- Screen readers announce meter value and range
- `aria-valuetext` provides context beyond percentage
- Visual representation should match announced value
- Color should not be the only indicator (use patterns/textures)
- Ensure sufficient color contrast
- Meters are not interactive (no keyboard support needed)

## Meter Variants

### Battery Meter
- Shows battery level (0-100%)
- Often includes time remaining in `aria-valuetext`
- Color zones: green (high), yellow (medium), red (low)

### Fuel Level Meter
- Shows fuel level (0-100%)
- May include distance remaining
- Visual gauge representation

### Disk Usage Meter
- Shows storage usage (0-100%)
- May include absolute values (GB used/total)
- Color zones for capacity warnings

### Performance Meter
- Shows CPU, memory, network usage
- Real-time updates
- Multiple meters for different metrics

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<meter>`) |
| Firefox | Full support (native `<meter>`) |
| Safari | Full support (native `<meter>`) |
| Edge | Full support (native `<meter>`) |

**Note**: Native HTML `<meter>` element has universal support in modern browsers. ARIA `role="meter"` also has universal support with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Meter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
- MDN: [HTML meter element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meter)
- MDN: [ARIA meter role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/meter_role)
- Related: [Progressbar Pattern](./aria-progressbar-pattern.md) - For task progress (not meter)
