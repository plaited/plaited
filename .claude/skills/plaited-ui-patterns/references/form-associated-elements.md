# Form-Associated Elements: Capturing User Intent

Form-associated custom elements enable capturing user intent through the ElementInternals API. These elements integrate seamlessly with HTML forms, providing custom controls with native form functionality.

**For bElement basics**, see `b-element.md`
**For BP coordination**, see `behavioral-programs.md`
**For styling custom states**, see `styling.md`

## Form-Associated Element Pattern

Enable form association by setting `formAssociated: true` in the bElement config:

```typescript
import { bElement } from 'plaited'

const CustomInput = bElement({
  tag: 'custom-input',
  formAssociated: true,  // Enables ElementInternals form integration
  shadowDom: <input type="text" p-target="input" p-trigger={{ input: 'inputChange' }} />,
  bProgram({ internals }) {
    return {
      inputChange(e) {
        const value = (e.target as HTMLInputElement).value
        // Set form value using ElementInternals
        internals.setFormValue(value)
      }
    }
  }
})

// Usage in HTML form
<form>
  <CustomInput name="username" />
  <button type="submit">Submit</button>
</form>
```

### ElementInternals API

When `formAssociated: true`, the `internals` object (via `BProgramArgs`) provides:

```typescript
type ElementInternals = {
  // Form integration
  setFormValue(value: string | FormData | null, state?: unknown): void
  form: HTMLFormElement | null
  willValidate: boolean

  // Validation
  setValidity(flags: ValidityStateFlags, message?: string, anchor?: HTMLElement): void
  checkValidity(): boolean
  reportValidity(): boolean
  validationMessage: string
  validity: ValidityState

  // Custom states (for CSS :state() selectors)
  states: CustomStateSet

  // Accessibility
  role: string | null
  ariaLabel: string | null
  // ... all ARIA properties
}
```

## internals.states Management

Custom states enable CSS styling based on element state using `:state()` pseudo-class:

### Adding/Removing Custom States

```typescript
const ToggleInput = bElement({
  tag: 'toggle-input',
  formAssociated: true,
  observedAttributes: ['checked', 'disabled'],
  hostStyles: createHostStyles({
    backgroundColor: {
      $default: 'lightblue',
      $compoundSelectors: {
        ':state(checked)': 'blue',      // Applied when checked state active
        ':state(disabled)': 'gray'      // Applied when disabled state active
      }
    }
  }),
  shadowDom: <div p-target="symbol" p-trigger={{ click: 'click' }} />,
  bProgram({ trigger, internals, root }) {
    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },

      checked(val) {
        root.host.toggleAttribute('checked', val)

        // Manage custom state
        if (val) {
          internals.states.add('checked')       // Activates :state(checked)
          internals.setFormValue('on', 'checked')
        } else {
          internals.states.delete('checked')    // Deactivates :state(checked)
          internals.setFormValue('off')
        }
      },

      disabled(val) {
        if (val) {
          internals.states.add('disabled')      // Activates :state(disabled)
        } else {
          internals.states.delete('disabled')   // Deactivates :state(disabled)
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          trigger({ type: 'checked', detail: newValue !== null })
        }
        if (name === 'disabled') {
          trigger({ type: 'disabled', detail: newValue !== null })
        }
      },

      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      }
    }
  }
})
```

### CustomStateSet API

```typescript
// Check if state exists
if (internals.states.has('checked')) {
  console.log('Element is checked')
}

// Add state
internals.states.add('invalid')

// Remove state
internals.states.delete('invalid')

// Clear all states
internals.states.clear()

// Iterate over states
for (const state of internals.states) {
  console.log(state)
}
```

### Styling Custom States

CSS can style elements based on custom states:

```typescript
const hostStyles = createHostStyles({
  backgroundColor: {
    $default: 'white',
    $compoundSelectors: {
      ':state(focused)': 'lightblue',
      ':state(invalid)': 'red',
      ':state(valid)': 'green',
      ':state(loading)': 'yellow'
    }
  },
  cursor: {
    $default: 'pointer',
    $compoundSelectors: {
      ':state(disabled)': 'not-allowed',
      ':state(loading)': 'wait'
    }
  }
})
```

**External CSS** can also style custom states:

```css
custom-input:state(focused) {
  outline: 2px solid blue;
}

custom-input:state(invalid) {
  border-color: red;
}
```

## internals.setFormValue()

Sets the element's value in the form data:

### Basic Usage

```typescript
// Simple value
internals.setFormValue('username123')

// When form submits, FormData contains:
// { elementName: 'username123' }
```

### Value vs State

`setFormValue()` accepts two parameters:

```typescript
internals.setFormValue(value, state?)
```

- **value**: What gets submitted with the form
- **state** (optional): Internal state for restoration (browser autocomplete)

```typescript
const RangeInput = bElement({
  tag: 'range-input',
  formAssociated: true,
  shadowDom: (
    <input
      type="range"
      min="0"
      max="100"
      p-target="range"
      p-trigger={{ input: 'rangeChange' }}
    />
  ),
  bProgram({ internals, $ }) {
    return {
      rangeChange(e) {
        const input = e.target as HTMLInputElement
        const value = input.value

        // Set both form value and internal state
        internals.setFormValue(
          value,                    // Value sent on form submit
          { rawValue: Number(value) } // State for restoration
        )
      },

      formStateRestoreCallback({ state }) {
        // Browser restores state (autocomplete, back button)
        if (state && typeof state === 'object' && 'rawValue' in state) {
          const range = $<HTMLInputElement>('range')[0]
          range?.attr('value', (state as { rawValue: number }).rawValue)
        }
      }
    }
  }
})
```

### Toggle Example (On/Off Values)

```typescript
const ToggleInput = bElement({
  tag: 'toggle-input',
  formAssociated: true,
  shadowDom: <div p-target="symbol" p-trigger={{ click: 'click' }} />,
  bProgram({ trigger, internals, root }) {
    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },

      checked(val) {
        if (val) {
          internals.states.add('checked')
          // "on" with custom state value
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        } else {
          internals.states.delete('checked')
          // "off" with no state
          internals.setFormValue('off')
        }
      }
    }
  }
})

// Usage with custom value
<ToggleInput name="newsletter" value="subscribed" checked />

// When checked, form data contains:
// { newsletter: 'on' }
// With state: 'subscribed'
```

### Complex Data (FormData)

For complex controls submitting multiple values:

```typescript
const DateRangePicker = bElement({
  tag: 'date-range-picker',
  formAssociated: true,
  shadowDom: (
    <>
      <input type="date" p-target="start" p-trigger={{ change: 'startChange' }} />
      <input type="date" p-target="end" p-trigger={{ change: 'endChange' }} />
    </>
  ),
  bProgram({ internals, root }) {
    let startDate = ''
    let endDate = ''

    const updateFormValue = () => {
      const formData = new FormData()
      const name = root.host.getAttribute('name') ?? 'dateRange'

      formData.append(`${name}[start]`, startDate)
      formData.append(`${name}[end]`, endDate)

      internals.setFormValue(formData)
    }

    return {
      startChange(e) {
        startDate = (e.target as HTMLInputElement).value
        updateFormValue()
      },

      endChange(e) {
        endDate = (e.target as HTMLInputElement).value
        updateFormValue()
      }
    }
  }
})

// Submits as:
// { "dateRange[start]": "2024-01-01", "dateRange[end]": "2024-12-31" }
```

## Form Lifecycle Callbacks

Form-associated elements receive lifecycle callbacks for form integration:

### formAssociatedCallback({ form })

Called when element is associated with a form:

```typescript
return {
  formAssociatedCallback({ form }) {
    console.log('Associated with form:', form?.id)

    // Can access form properties
    if (form) {
      form.addEventListener('submit', (e) => {
        console.log('Form submitting')
      })
    }
  }
}
```

### formDisabledCallback({ disabled })

Called when form's disabled state changes:

```typescript
return {
  formDisabledCallback({ disabled }) {
    // Sync element's disabled state with form
    if (disabled) {
      internals.states.add('disabled')
      root.host.setAttribute('disabled', '')
    } else {
      internals.states.delete('disabled')
      root.host.removeAttribute('disabled')
    }
  }
}
```

### formResetCallback()

Called when form is reset:

```typescript
return {
  formResetCallback() {
    // Reset to default state
    internals.states.delete('checked')
    internals.states.delete('invalid')
    internals.setFormValue('')

    // Reset UI
    const input = $<HTMLInputElement>('input')[0]
    input?.attr('value', '')
  }
}
```

### formStateRestoreCallback({ state, mode })

Called when browser restores form state (autocomplete, back button):

```typescript
return {
  formStateRestoreCallback({ state, mode }) {
    // mode: 'restore' (back button) or 'autocomplete'
    console.log('Restoring state:', state, 'Mode:', mode)

    if (state && typeof state === 'object' && 'value' in state) {
      const input = $<HTMLInputElement>('input')[0]
      input?.attr('value', state.value as string)
      internals.setFormValue(state.value as string)
    }
  }
}
```

## Validation & Feedback

Custom validation using ElementInternals validation API:

### setValidity()

Set validation state and message:

```typescript
const EmailInput = bElement({
  tag: 'email-input',
  formAssociated: true,
  shadowDom: <input type="email" p-target="input" p-trigger={{ input: 'inputChange' }} />,
  bProgram({ internals, $ }) {
    const validateEmail = (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value)
    }

    return {
      inputChange(e) {
        const input = e.target as HTMLInputElement
        const value = input.value

        if (!value) {
          // Required field empty
          internals.setValidity(
            { valueMissing: true },
            'Email is required',
            input
          )
          internals.states.add('invalid')
        } else if (!validateEmail(value)) {
          // Invalid email format
          internals.setValidity(
            { typeMismatch: true },
            'Please enter a valid email address',
            input
          )
          internals.states.add('invalid')
        } else {
          // Valid
          internals.setValidity({})
          internals.states.delete('invalid')
          internals.states.add('valid')
        }

        internals.setFormValue(value)
      }
    }
  }
})
```

### ValidityStateFlags

```typescript
type ValidityStateFlags = {
  badInput?: boolean           // Invalid input format
  customError?: boolean        // Custom validation failed
  patternMismatch?: boolean    // Doesn't match pattern
  rangeOverflow?: boolean      // Value > max
  rangeUnderflow?: boolean     // Value < min
  stepMismatch?: boolean       // Doesn't match step
  tooLong?: boolean           // Length > maxlength
  tooShort?: boolean          // Length < minlength
  typeMismatch?: boolean      // Invalid type (email, url, etc.)
  valueMissing?: boolean      // Required but empty
}
```

### Visual Validation Feedback

```typescript
const hostStyles = createHostStyles({
  borderColor: {
    $default: '#ccc',
    $compoundSelectors: {
      ':state(valid)': 'green',
      ':state(invalid)': 'red',
      ':state(focused):state(invalid)': 'darkred'
    }
  }
})

const ValidatedInput = bElement({
  tag: 'validated-input',
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <>
      <input
        type="text"
        p-target="input"
        p-trigger={{ input: 'inputChange', focus: 'focus', blur: 'blur' }}
      />
      <span p-target="error"></span>
    </>
  ),
  bProgram({ internals, $ }) {
    return {
      inputChange(e) {
        const input = e.target as HTMLInputElement
        const value = input.value

        // Validation logic
        if (!value.trim()) {
          internals.setValidity({ valueMissing: true }, 'This field is required', input)
          internals.states.add('invalid')
          internals.states.delete('valid')
        } else {
          internals.setValidity({})
          internals.states.delete('invalid')
          internals.states.add('valid')
        }

        // Update error message display
        const error = $('error')[0]
        error?.render(internals.validationMessage)

        internals.setFormValue(value)
      },

      focus() {
        internals.states.add('focused')
      },

      blur() {
        internals.states.delete('focused')
        // Trigger validation on blur
        if (internals.willValidate) {
          internals.reportValidity()
        }
      }
    }
  }
})
```

### checkValidity() vs reportValidity()

```typescript
return {
  submit() {
    // checkValidity(): Returns boolean, doesn't show UI
    if (internals.checkValidity()) {
      console.log('Valid')
    } else {
      console.log('Invalid')
    }

    // reportValidity(): Returns boolean AND shows browser validation UI
    if (!internals.reportValidity()) {
      console.log('Validation failed, browser showed error')
    }
  }
}
```

## Type-Driven Form Generation

Use TypeScript types or Zod schemas to generate form-associated elements:

### Using Zod Schemas

```typescript
import { z } from 'zod'
import { bElement } from 'plaited'

// Define schema
const UserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be at least 18 years old'),
  subscribed: z.boolean().default(false)
})

type UserFormData = z.infer<typeof UserSchema>

// Generate input based on schema field
const createInputForField = (
  fieldName: keyof UserFormData,
  schema: z.ZodTypeAny
) => {
  // Determine input type from schema
  if (schema instanceof z.ZodString) {
    if (fieldName === 'email') {
      return bElement({
        tag: `${fieldName}-input`,
        formAssociated: true,
        shadowDom: <input type="email" p-target="input" p-trigger={{ input: 'inputChange' }} />,
        bProgram({ internals, $ }) {
          return {
            inputChange(e) {
              const value = (e.target as HTMLInputElement).value
              const result = schema.safeParse(value)

              if (!result.success) {
                const error = result.error.errors[0]
                internals.setValidity({ customError: true }, error.message)
                internals.states.add('invalid')
              } else {
                internals.setValidity({})
                internals.states.delete('invalid')
              }

              internals.setFormValue(value)
            }
          }
        }
      })
    }
    return 'text-input'
  }

  if (schema instanceof z.ZodNumber) {
    return 'number-input'
  }

  if (schema instanceof z.ZodBoolean) {
    return 'toggle-input'
  }

  return 'text-input'
}

// Usage
const UsernameInput = createInputForField('username', UserSchema.shape.username)
```

### MCP Tool Schemas

For MCP (Model Context Protocol) apps, generate forms from tool schemas:

```typescript
type MCPTool = {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description?: string
      enum?: string[]
      default?: unknown
    }>
    required?: string[]
  }
}

const generateFormFromMCPTool = (tool: MCPTool) => {
  const inputs = Object.entries(tool.inputSchema.properties).map(([name, schema]) => {
    const isRequired = tool.inputSchema.required?.includes(name) ?? false

    if (schema.enum) {
      // Generate select element
      return createSelectInput(name, schema.enum, isRequired)
    }

    if (schema.type === 'boolean') {
      return <ToggleInput name={name} />
    }

    if (schema.type === 'number') {
      return <NumberInput name={name} required={isRequired} />
    }

    return <TextInput name={name} required={isRequired} />
  })

  return (
    <form>
      <h2>{tool.name}</h2>
      <p>{tool.description}</p>
      {inputs}
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Real Examples

### Example 1: ToggleInput (Custom Checkbox)

Complete toggle input with custom styling:

```typescript
import { bElement, createHostStyles, createStyles, createTokens } from 'plaited'
import { isTypeOf } from 'plaited/utils'

const { fills } = createTokens('fills', {
  default: { $value: 'lightblue' },
  checked: { $value: 'blue' },
  disabled: { $value: 'gray' }
})

const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: fills.default
  }
})

const hostStyles = createHostStyles({
  display: 'inline-grid',
  backgroundColor: {
    $default: fills.default,
    $compoundSelectors: {
      ':state(checked)': fills.checked,
      ':state(disabled)': fills.disabled
    }
  }
})

export const ToggleInput = bElement<{
  click: MouseEvent
  checked: boolean
  disabled: boolean
  valueChange: string | null
}>({
  tag: 'toggle-input',
  observedAttributes: ['disabled', 'checked', 'value'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target='symbol'
      {...styles.symbol}
      p-trigger={{ click: 'click' }}
    />
  ),
  bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
    // Block checked/valueChange when disabled
    bThreads.set({
      onDisabled: bThread([
        bSync({
          block: [
            ({ type }) => type === 'checked' && internals.states.has('disabled'),
            ({ type }) => type === 'valueChange' && internals.states.has('disabled')
          ]
        })
      ], true)
    })

    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },

      checked(val) {
        root.host.toggleAttribute('checked', val)
        if (val) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        } else {
          internals.states.delete('checked')
          internals.setFormValue('off')
        }
      },

      disabled(val) {
        if (val) {
          internals.states.add('disabled')
        } else {
          internals.states.delete('disabled')
        }
      },

      valueChange(val) {
        const isChecked = internals.states.has('checked')
        if (val && isChecked) {
          internals.setFormValue('on', val)
        } else if (isChecked) {
          internals.setFormValue('on', 'checked')
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'checked') {
          trigger({ type: 'checked', detail: isTypeOf<string>(newValue, 'string') })
        }
        if (name === 'disabled') {
          trigger({ type: 'disabled', detail: isTypeOf<string>(newValue, 'string') })
        }
        if (name === 'value') {
          trigger({ type: 'valueChange', detail: newValue })
        }
      },

      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      }
    }
  }
})

// Usage
<form>
  <ToggleInput name="newsletter" value="subscribed" checked />
  <button type="submit">Submit</button>
</form>
```

### Example 2: RatingInput (Non-Existent Native Element)

Star rating control for forms:

```typescript
const RatingInput = bElement({
  tag: 'rating-input',
  formAssociated: true,
  observedAttributes: ['value', 'max'],
  hostStyles: createHostStyles({
    display: 'inline-flex',
    gap: '4px'
  }),
  shadowDom: <div p-target="container"></div>,
  bProgram({ $, internals, root, trigger }) {
    let maxRating = 5
    let currentRating = 0

    const renderStars = () => {
      const container = $('container')[0]
      const stars = []

      for (let i = 1; i <= maxRating; i++) {
        stars.push(
          <button
            type="button"
            p-target={`star-${i}`}
            data-value={i}
            p-trigger={{ click: 'rate' }}
          >
            {i <= currentRating ? '★' : '☆'}
          </button>
        )
      }

      container?.render(...stars)
    }

    return {
      rate(e) {
        const value = Number((e.target as HTMLElement).dataset.value)
        currentRating = value
        internals.setFormValue(String(value))
        renderStars()
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'max' && newValue) {
          maxRating = Number(newValue)
          renderStars()
        }
        if (name === 'value' && newValue) {
          currentRating = Number(newValue)
          internals.setFormValue(newValue)
          renderStars()
        }
      },

      onConnected() {
        const maxAttr = root.host.getAttribute('max')
        const valueAttr = root.host.getAttribute('value')

        if (maxAttr) maxRating = Number(maxAttr)
        if (valueAttr) {
          currentRating = Number(valueAttr)
          internals.setFormValue(valueAttr)
        }

        renderStars()
      },

      formResetCallback() {
        currentRating = 0
        internals.setFormValue('0')
        renderStars()
      }
    }
  }
})

// Usage
<form>
  <RatingInput name="rating" max="5" value="3" />
  <button type="submit">Submit</button>
</form>
```

## Summary: Form-Associated Elements

**Key capabilities**:
- Native form integration via `formAssociated: true`
- Custom states for CSS styling (`:state()` selectors)
- Form value management with `internals.setFormValue()`
- Built-in validation with `internals.setValidity()`
- Lifecycle callbacks for form events
- Type-safe schema-driven form generation

**Best practices**:
- Use custom states for visual feedback
- Provide clear validation messages
- Handle form reset and restoration
- Coordinate validation with behavioral threads
- Generate forms from schemas for consistency

**Next steps**:
- See `b-element.md` for bElement fundamentals
- See `behavioral-programs.md` for BP coordination
- See `styling.md` for custom state styling
- See `cross-island-communication.md` for form coordination
