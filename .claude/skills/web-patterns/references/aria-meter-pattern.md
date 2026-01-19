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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

**File Structure:**

```
meter/
  meter.css.ts       # Styles (createStyles) - ALWAYS separate
  meter.stories.tsx  # FT/bElement + stories (imports from css.ts)
```

#### meter.css.ts

```typescript
// meter.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
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
    backgroundColor: '#4caf50',
    transition: 'inline-size 0.3s ease',
    borderRadius: '10px',
  },
  fillLow: {
    backgroundColor: '#ff9800',
  },
  fillHigh: {
    backgroundColor: '#f44336',
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
  nativeMeter: {
    inlineSize: '100%',
    blockSize: '20px',
  },
})
```

#### meter.stories.tsx

```typescript
// meter.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './meter.css.ts'

// NativeMeter FunctionalTemplate - defined locally, NOT exported
const NativeMeter: FT<{
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
    {...styles.nativeMeter}
  >
    {children || `${value}%`}
  </meter>
)

// CustomMeter FunctionalTemplate - defined locally, NOT exported
const CustomMeter: FT<{
  'aria-valuenow': number
  'aria-valuemin'?: number
  'aria-valuemax'?: number
  'aria-label'?: string
  'aria-valuetext'?: string
  showLabel?: boolean
  children?: Children
}> = ({
  'aria-valuenow': ariaValueNow,
  'aria-valuemin': ariaValueMin = 0,
  'aria-valuemax': ariaValueMax = 100,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  showLabel = true,
  children,
  ...attrs
}) => {
  const percentage = ((ariaValueNow - ariaValueMin) / (ariaValueMax - ariaValueMin)) * 100

  return (
    <div
      role="meter"
      aria-valuenow={ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      {...attrs}
      {...styles.meter}
    >
      <div {...styles.track} aria-hidden="true">
        <div
          {...styles.fill}
          {...(percentage < 25 ? styles.fillLow : {})}
          {...(percentage > 75 ? styles.fillHigh : {})}
          style={{ inlineSize: `${percentage}%` }}
        ></div>
      </div>
      {showLabel && <div {...styles.label}>{children || `${Math.round(percentage)}%`}</div>}
    </div>
  )
}

// DynamicMeter bElement - defined locally, NOT exported
const DynamicMeter = bElement({
  tag: 'pattern-meter',
  observedAttributes: ['value', 'min', 'max', 'aria-label', 'aria-valuetext'],
  hostStyles,
  shadowDom: (
    <div p-target="meter" role="meter" {...styles.meter}>
      <div p-target="track" {...styles.track} aria-hidden="true">
        <div p-target="fill" {...styles.fill}></div>
      </div>
      <div p-target="label" {...styles.label}></div>
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
      currentValue = Math.max(min, Math.min(max, value))
      const percentage = ((currentValue - min) / (max - min)) * 100

      meter?.attr('aria-valuenow', String(currentValue))
      meter?.attr('aria-valuemin', String(min))
      meter?.attr('aria-valuemax', String(max))

      fill?.attr('style', `inline-size: ${percentage}%`)

      // Update color based on thresholds
      const baseClasses = styles.fill.classNames.join(' ')
      if (percentage < 25) {
        fill?.attr('class', `${baseClasses} ${styles.fillLow.classNames.join(' ')}`)
      } else if (percentage > 75) {
        fill?.attr('class', `${baseClasses} ${styles.fillHigh.classNames.join(' ')}`)
      } else {
        fill?.attr('class', baseClasses)
      }

      label?.render(`${Math.round(percentage)}%`)

      emit({ type: 'update', detail: { value: currentValue, percentage } })
    }

    return {
      onConnected() {
        const valueAttr = host.getAttribute('value')
        const minAttr = host.getAttribute('min')
        const maxAttr = host.getAttribute('max')
        const ariaLabel = host.getAttribute('aria-label')

        if (minAttr) min = Number(minAttr)
        if (maxAttr) max = Number(maxAttr)
        if (ariaLabel) meter?.attr('aria-label', ariaLabel)

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

// Stories - EXPORTED for testing/training
export const nativeMeter = story({
  intent: 'Display a native HTML meter element for battery level',
  template: () => (
    <NativeMeter value={75} min={0} max={100} aria-label="Battery level">
      75%
    </NativeMeter>
  ),
  play: async ({ findByAttribute, assert }) => {
    const meter = await findByAttribute('aria-label', 'Battery level')

    assert({
      given: 'native meter is rendered',
      should: 'have correct value',
      actual: meter?.getAttribute('value'),
      expected: '75',
    })
  },
})

export const customMeter = story({
  intent: 'Display a custom styled meter with ARIA role',
  template: () => (
    <CustomMeter
      aria-valuenow={60}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Disk usage"
    >
      60% used
    </CustomMeter>
  ),
  play: async ({ findByAttribute, assert }) => {
    const meter = await findByAttribute('role', 'meter')

    assert({
      given: 'custom meter is rendered',
      should: 'have meter role',
      actual: meter?.getAttribute('role'),
      expected: 'meter',
    })
  },
})

export const batteryMeter = story({
  intent: 'Display a battery level meter with custom text',
  template: () => (
    <DynamicMeter
      value={50}
      min={0}
      max={100}
      aria-label="Battery level"
      aria-valuetext="50% (6 hours) remaining"
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const meter = await findByAttribute('role', 'meter')

    assert({
      given: 'battery meter is rendered',
      should: 'have aria-valuetext',
      actual: meter?.getAttribute('aria-valuetext'),
      expected: '50% (6 hours) remaining',
    })
  },
})

export const lowValueMeter = story({
  intent: 'Display a meter with low value showing warning color',
  template: () => (
    <DynamicMeter
      value={15}
      min={0}
      max={100}
      aria-label="Fuel level"
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const meter = await findByAttribute('role', 'meter')

    assert({
      given: 'low value meter is rendered',
      should: 'have low value',
      actual: meter?.getAttribute('aria-valuenow'),
      expected: '15',
    })
  },
})

export const highValueMeter = story({
  intent: 'Display a meter with high value showing critical color',
  template: () => (
    <DynamicMeter
      value={90}
      min={0}
      max={100}
      aria-label="Disk usage"
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const meter = await findByAttribute('role', 'meter')

    assert({
      given: 'high value meter is rendered',
      should: 'have high value',
      actual: meter?.getAttribute('aria-valuenow'),
      expected: '90',
    })
  },
})

export const staticMeters = story({
  intent: 'Display various static meter examples',
  template: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <CustomMeter aria-valuenow={25} aria-label="Low usage">Low (25%)</CustomMeter>
      <CustomMeter aria-valuenow={50} aria-label="Medium usage">Medium (50%)</CustomMeter>
      <CustomMeter aria-valuenow={75} aria-label="High usage">High (75%)</CustomMeter>
      <CustomMeter aria-valuenow={90} aria-label="Critical usage">Critical (90%)</CustomMeter>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - meters can use Shadow DOM
- **Uses bElement built-ins**: `$`, `p-target`, `emit`, `attr`, `render`
- **Requires external web API**: No
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
2. **Use FunctionalTemplates** - for static meters in stories
3. **Use bElement** - for dynamic meters that need to update from external sources
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Meaningful ranges** - Ensure min/max represent meaningful limits
6. **Custom text** - Use `aria-valuetext` for better context (e.g., "50% (6 hours)")
7. **Visual feedback** - Use color zones to indicate thresholds
8. **Accessible labels** - Always provide `aria-label` or `aria-labelledby`
9. **Don't use for progress** - Use `progressbar` role for task completion
10. **Use `$()` with `p-target`** - never use `querySelector` directly

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

## References

- Source: [W3C ARIA Authoring Practices Guide - Meter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
- MDN: [HTML meter element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meter)
- MDN: [ARIA meter role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/meter_role)
- Related: [Progressbar Pattern](./aria-progressbar-pattern.md) - For task progress (not meter)
