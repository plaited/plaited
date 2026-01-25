# Form Structure Pattern

## Overview

Forms are essential HTML elements that allow users to send information to a server. Proper form structure is critical for usability, accessibility, and conversion rates. This pattern covers best practices for structuring web forms, including semantic HTML, field organization, validation, and UX considerations.

**Key Characteristics:**

- **Semantic structure**: Use proper HTML form elements (`<form>`, `<fieldset>`, `<legend>`, `<label>`)
- **Logical grouping**: Organize fields by purpose and relationship
- **Accessibility**: Proper labeling, ARIA attributes, and keyboard navigation
- **Progressive enhancement**: Works without JavaScript, enhanced with it
- **Validation**: Inline validation with clear error messages
- **Mobile-friendly**: Responsive design with native input types

## Use Cases

- User registration and login
- Contact forms
- Payment and checkout forms
- Settings and preferences
- Search forms
- Multi-step wizards
- Data entry and editing
- Survey and feedback forms

## Implementation

### Vanilla JavaScript

#### Basic Form Structure

```html
<form id="payment-form" novalidate>
  <h1>Payment form</h1>
  <p>Please complete all required (*) fields.</p>

  <section>
    <h2>Contact information</h2>
    
    <fieldset>
      <legend>Title</legend>
      <ul>
        <li>
          <input type="radio" id="title_1" name="title" value="A" />
          <label for="title_1">Ace</label>
        </li>
        <li>
          <input type="radio" id="title_2" name="title" value="K" />
          <label for="title_2">King</label>
        </li>
        <li>
          <input type="radio" id="title_3" name="title" value="Q" />
          <label for="title_3">Queen</label>
        </li>
      </ul>
    </fieldset>

    <p>
      <label for="name">Name *:</label>
      <input type="text" id="name" name="username" required />
    </p>

    <p>
      <label for="mail">Email *:</label>
      <input type="email" id="mail" name="user-mail" required />
    </p>

    <p>
      <label for="pwd">Password *:</label>
      <input type="password" id="pwd" name="password" required />
      <span class="helper-text">Password should be 8 or more characters</span>
    </p>
  </section>

  <section>
    <h2>Payment information</h2>
    
    <p>
      <label for="card">Card type:</label>
      <select id="card" name="user-card">
        <option value="visa">Visa</option>
        <option value="mc">Mastercard</option>
        <option value="amex">American Express</option>
      </select>
    </p>

    <p>
      <label for="number">Card number *:</label>
      <input type="tel" id="number" name="card-number" required />
      <span class="helper-text">Enter your card number without spaces</span>
    </p>

    <p>
      <label for="expiration">Expiration date *:</label>
      <input
        type="text"
        id="expiration"
        name="expiration"
        required
        placeholder="MM/YY"
        pattern="^(0[1-9]|1[0-2])\/([0-9]{2})$"
      />
    </p>
  </section>

  <section>
    <p>
      <button type="submit">Validate the payment</button>
    </p>
  </section>
</form>
```

#### Inline Validation

```javascript
// Validate on input
const emailInput = document.getElementById('mail')
emailInput.addEventListener('input', (e) => {
  const value = e.target.value
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  
  if (value && !isValid) {
    e.target.setCustomValidity('Please enter a valid email address')
    e.target.classList.add('invalid')
  } else {
    e.target.setCustomValidity('')
    e.target.classList.remove('invalid')
    e.target.classList.add('valid')
  }
})

// Form submission
document.getElementById('payment-form').addEventListener('submit', (e) => {
  e.preventDefault()
  
  if (e.target.checkValidity()) {
    // Submit form
    console.log('Form is valid')
  } else {
    // Show validation errors
    e.target.reportValidity()
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, forms can be implemented as:

1. **Functional Templates (FT)** for static forms in stories
2. **bElements** for form containers that need validation coordination
3. **Form-associated bElements** for custom form controls
4. **Combination** of native form elements and custom bElements

#### Form Container (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles, createHostStyles } from 'plaited/ui'

const formStyles = createStyles({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '2rem'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  fieldset: {
    border: '1px solid #ccc',
    borderRadius: '0.5rem',
    padding: '1rem',
    margin: 0
  },
  legend: {
    fontWeight: 'bold',
    padding: '0 0.5rem'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  label: {
    fontWeight: '500',
    fontSize: '0.875rem'
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ccc',
    borderRadius: '0.25rem',
    fontSize: '1rem'
  },
  helperText: {
    fontSize: '0.75rem',
    color: '#666'
  },
  errorText: {
    fontSize: '0.75rem',
    color: '#d32f2f'
  },
  submitButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '1rem',
    cursor: 'pointer'
  }
})

const hostStyles = createHostStyles({
  display: 'block',
  inlineSize: '100%'
})

export const FormContainer = bElement<{
  submit: FormData
  fieldChange: { name: string; value: string }
}>({
  tag: 'form-container',
  hostStyles,
  shadowDom: (
    <form
      p-target="form"
      p-trigger={{ submit: 'handleSubmit' }}
      {...formStyles.form}
      novalidate
    >
      <h1>Payment form</h1>
      <p>Please complete all required (*) fields.</p>
      
      <section p-target="contactSection" {...formStyles.section}>
        <h2>Contact information</h2>
        
        <fieldset {...formStyles.fieldset}>
          <legend {...formStyles.legend}>Title</legend>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              <input
                type="radio"
                id="title_1"
                name="title"
                value="A"
                p-trigger={{ change: 'fieldChange' }}
              />
              <label htmlFor="title_1">Ace</label>
            </li>
            <li>
              <input
                type="radio"
                id="title_2"
                name="title"
                value="K"
                p-trigger={{ change: 'fieldChange' }}
              />
              <label htmlFor="title_2">King</label>
            </li>
            <li>
              <input
                type="radio"
                id="title_3"
                name="title"
                value="Q"
                p-trigger={{ change: 'fieldChange' }}
              />
              <label htmlFor="title_3">Queen</label>
            </li>
          </ul>
        </fieldset>

        <div {...formStyles.fieldGroup}>
          <label htmlFor="name" {...formStyles.label}>
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="username"
            required
            p-target="nameInput"
            p-trigger={{ input: 'fieldChange', blur: 'validateField' }}
            {...formStyles.input}
          />
          <span p-target="nameError" {...formStyles.errorText}></span>
        </div>

        <div {...formStyles.fieldGroup}>
          <label htmlFor="mail" {...formStyles.label}>
            Email *
          </label>
          <input
            type="email"
            id="mail"
            name="user-mail"
            required
            p-target="emailInput"
            p-trigger={{ input: 'fieldChange', blur: 'validateField' }}
            {...formStyles.input}
          />
          <span p-target="emailError" {...formStyles.errorText}></span>
        </div>

        <div {...formStyles.fieldGroup}>
          <label htmlFor="pwd" {...formStyles.label}>
            Password *
          </label>
          <input
            type="password"
            id="pwd"
            name="password"
            required
            minLength={8}
            p-target="passwordInput"
            p-trigger={{ input: 'fieldChange', blur: 'validateField' }}
            {...formStyles.input}
          />
          <span {...formStyles.helperText}>
            Password should be 8 or more characters
          </span>
          <span p-target="passwordError" {...formStyles.errorText}></span>
        </div>
      </section>

      <section p-target="paymentSection" {...formStyles.section}>
        <h2>Payment information</h2>
        
        <div {...formStyles.fieldGroup}>
          <label htmlFor="card" {...formStyles.label}>
            Card type:
          </label>
          <select
            id="card"
            name="user-card"
            p-target="cardSelect"
            p-trigger={{ change: 'fieldChange' }}
            {...formStyles.input}
          >
            <option value="visa">Visa</option>
            <option value="mc">Mastercard</option>
            <option value="amex">American Express</option>
          </select>
        </div>

        <div {...formStyles.fieldGroup}>
          <label htmlFor="number" {...formStyles.label}>
            Card number *
          </label>
          <input
            type="tel"
            id="number"
            name="card-number"
            required
            p-target="cardInput"
            p-trigger={{ input: 'fieldChange', blur: 'validateField' }}
            {...formStyles.input}
          />
          <span {...formStyles.helperText}>
            Enter your card number without spaces
          </span>
          <span p-target="cardError" {...formStyles.errorText}></span>
        </div>

        <div {...formStyles.fieldGroup}>
          <label htmlFor="expiration" {...formStyles.label}>
            Expiration date *
          </label>
          <input
            type="text"
            id="expiration"
            name="expiration"
            required
            placeholder="MM/YY"
            pattern="^(0[1-9]|1[0-2])\/([0-9]{2})$"
            p-target="expirationInput"
            p-trigger={{ input: 'fieldChange', blur: 'validateField' }}
            {...formStyles.input}
          />
          <span p-target="expirationError" {...formStyles.errorText}></span>
        </div>
      </section>

      <section {...formStyles.section}>
        <button type="submit" {...formStyles.submitButton}>
          Validate the payment
        </button>
      </section>
    </form>
  ),
  bProgram({ $, root, trigger, emit }) {
    const validateEmail = (value: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    }

    const validateCardNumber = (value: string): boolean => {
      // Remove spaces and validate
      const cleaned = value.replace(/\s/g, '')
      return /^\d{13,19}$/.test(cleaned)
    }

    const showError = (target: string, message: string) => {
      const errorEl = $<HTMLElement>(target)[0]
      if (errorEl) {
        errorEl.render(message)
        errorEl.style.display = 'block'
      }
    }

    const clearError = (target: string) => {
      const errorEl = $<HTMLElement>(target)[0]
      if (errorEl) {
        errorEl.render('')
        errorEl.style.display = 'none'
      }
    }

    const validateField = (name: string, value: string) => {
      switch (name) {
        case 'user-mail':
          if (value && !validateEmail(value)) {
            showError('emailError', 'Please enter a valid email address')
            return false
          } else {
            clearError('emailError')
            return true
          }

        case 'card-number':
          if (value && !validateCardNumber(value)) {
            showError('cardError', 'Please enter a valid card number')
            return false
          } else {
            clearError('cardError')
            return true
          }

        case 'password':
          if (value && value.length < 8) {
            showError('passwordError', 'Password must be at least 8 characters')
            return false
          } else {
            clearError('passwordError')
            return true
          }

        default:
          return true
      }
    }

    return {
      fieldChange(e) {
        const target = e.target as HTMLInputElement | HTMLSelectElement
        const name = target.name
        const value = target.value

        emit({
          type: 'fieldChange',
          detail: { name, value }
        })

        // Inline validation for specific fields
        if (name === 'user-mail' || name === 'card-number' || name === 'password') {
          validateField(name, value)
        }
      },

      validateField(e) {
        const target = e.target as HTMLInputElement
        validateField(target.name, target.value)
      },

      handleSubmit(e) {
        e.preventDefault()
        const form = e.target as HTMLFormElement

        // Validate all fields
        let isValid = true
        const formData = new FormData(form)

        // Check required fields
        const nameInput = $<HTMLInputElement>('nameInput')[0]
        const emailInput = $<HTMLInputElement>('emailInput')[0]
        const passwordInput = $<HTMLInputElement>('passwordInput')[0]
        const cardInput = $<HTMLInputElement>('cardInput')[0]
        const expirationInput = $<HTMLInputElement>('expirationInput')[0]

        if (!nameInput?.value) {
          showError('nameError', 'Name is required')
          isValid = false
        } else {
          clearError('nameError')
        }

        if (!emailInput?.value) {
          showError('emailError', 'Email is required')
          isValid = false
        } else if (!validateEmail(emailInput.value)) {
          showError('emailError', 'Please enter a valid email address')
          isValid = false
        } else {
          clearError('emailError')
        }

        if (!passwordInput?.value) {
          showError('passwordError', 'Password is required')
          isValid = false
        } else if (passwordInput.value.length < 8) {
          showError('passwordError', 'Password must be at least 8 characters')
          isValid = false
        } else {
          clearError('passwordError')
        }

        if (!cardInput?.value) {
          showError('cardError', 'Card number is required')
          isValid = false
        } else if (!validateCardNumber(cardInput.value)) {
          showError('cardError', 'Please enter a valid card number')
          isValid = false
        } else {
          clearError('cardError')
        }

        if (!expirationInput?.value) {
          showError('expirationError', 'Expiration date is required')
          isValid = false
        } else if (!expirationInput.validity.valid) {
          showError('expirationError', 'Please enter a valid expiration date (MM/YY)')
          isValid = false
        } else {
          clearError('expirationError')
        }

        if (isValid) {
          emit({
            type: 'submit',
            detail: formData
          })
        } else {
          // Focus first invalid field
          const firstError = form.querySelector('.invalid, [aria-invalid="true"]')
          if (firstError instanceof HTMLElement) {
            firstError.focus()
          }
        }
      }
    }
  }
})
```

#### Form with Custom Form-Associated Elements

```typescript
import { bElement } from 'plaited/ui'
import { EmailInput } from './email-input' // Custom form-associated element
import { PasswordInput } from './password-input' // Custom form-associated element

export const AdvancedForm = bElement({
  tag: 'advanced-form',
  shadowDom: (
    <form p-target="form" p-trigger={{ submit: 'handleSubmit' }} novalidate>
      <h1>Sign up</h1>
      
      <section>
        <h2>Account information</h2>
        
        <EmailInput
          name="email"
          required
          p-trigger={{ 
            fieldChange: 'fieldChange',
            validationChange: 'validationChange'
          }}
        />
        
        <PasswordInput
          name="password"
          required
          minLength={8}
          p-trigger={{ 
            fieldChange: 'fieldChange',
            validationChange: 'validationChange'
          }}
        />
      </section>

      <button type="submit">Create account</button>
    </form>
  ),
  bProgram({ $, emit }) {
    let formValid = false

    return {
      fieldChange(e) {
        emit({
          type: 'fieldChange',
          detail: {
            name: (e.target as HTMLElement).getAttribute('name'),
            value: (e.target as HTMLElement).getAttribute('value')
          }
        })
      },

      validationChange(e) {
        // Track validation state from custom elements
        const isValid = e.detail?.isValid ?? false
        formValid = isValid
      },

      handleSubmit(e) {
        e.preventDefault()
        const form = e.target as HTMLFormElement

        if (form.checkValidity() && formValid) {
          const formData = new FormData(form)
          emit({
            type: 'submit',
            detail: formData
          })
        } else {
          form.reportValidity()
        }
      }
    }
  }
})
```

## Best Practices

### 1. Form Structure

#### Minimize Fields

- Only ask for essential information
- Remove optional fields if not truly needed
- Use progressive disclosure for additional information

#### Logical Grouping

- Group related fields using `<fieldset>` and `<legend>`
- Use `<section>` for major form sections
- Order fields from easiest to hardest

#### One-Column Layout

- Use vertical layout for better usability
- Reduces eye movement and missed fields
- Improves mobile experience

### 2. Labels and Accessibility

#### Label Placement

- Place labels **above** input fields (not to the left)
- Use explicit `<label>` with `for` attribute
- Never use placeholder text as labels

```html
<!-- Good: Label above -->
<label for="email">Email *</label>
<input type="email" id="email" name="email" required />

<!-- Bad: Label to the left -->
<label for="email">Email *</label>
<input type="email" id="email" name="email" required />
```

#### Required Fields

- Mark required fields clearly (use "(optional)" for optional fields)
- Use `required` attribute for native validation
- Provide helper text explaining why information is needed

#### Helper Text

- Display helper text visibly (don't hide behind icons)
- Use for format instructions (e.g., "Enter without spaces")
- Explain why information is needed

### 3. Input Types and Format

#### Use Native Input Types

Use semantic input types to provide better UX, validation, and mobile keyboard support. The following input types are available:

**Text Input Types:**
- `type="text"` - Default single-line text field (line-breaks automatically removed)
- `type="email"` - Email address field with validation and email keyboard on mobile
- `type="password"` - Single-line text field with obscured value (alerts if site not secure)
- `type="search"` - Search string field (line-breaks removed, may show delete icon)
- `type="tel"` - Telephone number (displays telephone keypad on mobile)
- `type="url"` - URL field with validation and URL keyboard on mobile

**Numeric Input Types:**
- `type="number"` - Number input with spinner and numeric keypad on mobile (use `min`, `max`, `step`)
- `type="range"` - Slider for approximate numeric values (use `min`, `max`, `step`)

**Date and Time Input Types:**
- `type="date"` - Date picker (year, month, day, no time)
- `type="datetime-local"` - Date and time picker (no time zone)
- `type="month"` - Month and year picker
- `type="time"` - Time picker (no time zone)
- `type="week"` - Week picker (week-year number and week number)

**Selection Input Types:**
- `type="checkbox"` - Checkbox for single value selection/deselection
- `type="radio"` - Radio button for single choice from multiple options (same `name` groups them)

**File Input Types:**
- `type="file"` - File selection control (use `accept` attribute to filter file types)
- `type="color"` - Color picker control

**Button Input Types:**
- `type="button"` - Push button with no default behavior
- `type="submit"` - Form submission button
- `type="reset"` - Form reset button (not recommended)
- `type="image"` - Graphical submit button (use `src` and `alt` attributes)

**Special Input Types:**
- `type="hidden"` - Hidden control (not displayed, value submitted with form)

**Best Practices:**
- Use `type="email"` for email addresses (provides validation and mobile keyboard)
- Use `type="tel"` for phone numbers (shows telephone keypad on mobile)
- Use `type="date"` for dates (native pickers on mobile provide better UX)
- Use `type="number"` for numeric input when exact values matter (with `min`, `max`, `step`)
- Use `type="range"` for approximate values or when exact value isn't important
- Use `type="url"` for URLs (provides validation and URL keyboard)
- Use `type="search"` for search fields (may show search icon on mobile)
- Use `type="password"` for passwords
- Avoid `type="number"` for credit cards or phone numbers (use `type="tel"` or `type="text"` with pattern)

#### Single Input Fields

- Don't split phone numbers or credit cards into multiple fields
- Use a single input with formatting/validation

#### Placeholder Text

- Use for format hints (e.g., "MM/YY")
- Never use as a replacement for labels
- Keep placeholder text concise

### 4. Validation

#### Inline Validation
- Validate on blur (when user leaves field)
- Show errors immediately after user interaction
- Provide clear, actionable error messages

#### Error Messages
- Be specific: "Please enter a valid email address" not "Invalid data"
- Show errors near the field
- Use consistent error styling

#### Success Indicators
- Show checkmarks for valid fields
- Provide positive feedback for progress
- Disable submit button until form is valid (optional)

### 5. Multi-Step Forms

#### Progress Indication
- Show step numbers (e.g., "Step 1 of 3")
- Use progress bars or step indicators
- Allow navigation between steps

#### Milestone Submission
- Save progress at key points
- Allow users to return and complete later
- Submit critical information early

### 6. Mobile Considerations

#### Native Features
- Use native date pickers (`type="date"`)
- Use native number inputs (`type="number"`)
- Ensure inputs are large enough for touch

#### Responsive Design
- Test on actual mobile devices
- Consider multi-screen format for long forms
- Ensure buttons are easily tappable

### 7. Button Text

#### Action-Oriented
- Use descriptive text: "Create account" not "Submit"
- Consider first-person: "Create my account"
- Match button text to the action

#### Button States
- Disable submit button until validation passes (optional)
- Show loading state during submission
- Provide clear success/error feedback

## Plaited Integration

- **Works with Shadow DOM**: Yes - forms can be in Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for form events
  - `p-target` for field references
  - `emit` for cross-element communication
- **Requires external web API**: No - uses native form APIs
- **Cleanup required**: No - form elements are managed by browser

### Form-Associated Elements

For custom form controls, use `formAssociated: true`:

```typescript
const CustomInput = bElement({
  tag: 'custom-input',
  formAssociated: true, // Enables ElementInternals
  shadowDom: <input p-target="input" />,
  bProgram({ internals, $ }) {
    return {
      inputChange(e) {
        const value = (e.target as HTMLInputElement).value
        internals.setFormValue(value)
        
        // Validation
        if (!value) {
          internals.setValidity({ valueMissing: true }, 'This field is required')
          internals.states.add('invalid')
        } else {
          internals.setValidity({})
          internals.states.delete('invalid')
        }
      }
    }
  }
})
```

## Browser Compatibility

| Browser | Form Support | ElementInternals | Custom States |
|---------|--------------|-------------------|---------------|
| Chrome | Full | 77+ | 119+ |
| Firefox | Full | 93+ | 119+ |
| Safari | Full | 16.4+ | 17.0+ |
| Edge | Full | 79+ | 119+ |

## Accessibility

### ARIA Considerations

- Use native form elements when possible (better than ARIA)
- Use `aria-required="true"` for required fields (redundant with `required`)
- Use `aria-invalid="true"` for invalid fields
- Use `aria-describedby` to link error messages to fields

```html
<input
  type="email"
  id="email"
  name="email"
  required
  aria-invalid="false"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert" aria-live="polite"></span>
```

### Keyboard Navigation

- All form controls must be keyboard accessible
- Tab order should follow visual order
- Use `tabindex` sparingly (only for custom controls)
- Ensure focus indicators are visible

### Screen Reader Support

- Labels are read automatically with native elements
- Error messages should be announced (use `role="alert"`)
- Fieldset legends provide context for grouped fields
- Helper text should be associated with fields

## Common Patterns

### Pattern 1: Simple Contact Form

```typescript
const ContactForm = bElement({
  tag: 'contact-form',
  shadowDom: (
    <form p-target="form" p-trigger={{ submit: 'handleSubmit' }}>
      <div>
        <label htmlFor="name">Name *</label>
        <input type="text" id="name" name="name" required />
      </div>
      
      <div>
        <label htmlFor="email">Email *</label>
        <input type="email" id="email" name="email" required />
      </div>
      
      <div>
        <label htmlFor="message">Message *</label>
        <textarea id="message" name="message" required></textarea>
      </div>
      
      <button type="submit">Send message</button>
    </form>
  ),
  bProgram({ $, emit }) {
    return {
      handleSubmit(e) {
        e.preventDefault()
        const form = e.target as HTMLFormElement
        
        if (form.checkValidity()) {
          const formData = new FormData(form)
          emit({ type: 'submit', detail: formData })
        } else {
          form.reportValidity()
        }
      }
    }
  }
})
```

### Pattern 2: Multi-Step Form

```typescript
const MultiStepForm = bElement({
  tag: 'multi-step-form',
  observedAttributes: ['step'],
  shadowDom: (
    <form p-target="form" p-trigger={{ submit: 'handleSubmit' }}>
      <div p-target="progress">Step 1 of 3</div>
      
      <section p-target="step1" style={{ display: 'block' }}>
        <h2>Personal information</h2>
        <input type="text" name="name" required />
        <input type="email" name="email" required />
        <button type="button" p-trigger={{ click: 'nextStep' }}>Next</button>
      </section>
      
      <section p-target="step2" style={{ display: 'none' }}>
        <h2>Address</h2>
        <input type="text" name="address" required />
        <button type="button" p-trigger={{ click: 'prevStep' }}>Previous</button>
        <button type="button" p-trigger={{ click: 'nextStep' }}>Next</button>
      </section>
      
      <section p-target="step3" style={{ display: 'none' }}>
        <h2>Review</h2>
        <button type="submit">Submit</button>
      </section>
    </form>
  ),
  bProgram({ $, root, trigger }) {
    let currentStep = 1
    const totalSteps = 3

    const showStep = (step: number) => {
      for (let i = 1; i <= totalSteps; i++) {
        const stepEl = $(`step${i}`)[0] as HTMLElement
        if (stepEl) {
          stepEl.style.display = i === step ? 'block' : 'none'
        }
      }
      
      const progress = $('progress')[0]
      if (progress) {
        progress.render(`Step ${step} of ${totalSteps}`)
      }
      
      root.host.setAttribute('step', String(step))
    }

    return {
      nextStep() {
        const form = $('form')[0] as HTMLFormElement
        const currentSection = $(`step${currentStep}`)[0] as HTMLElement
        
        // Validate current step
        const inputs = currentSection?.querySelectorAll('input[required]')
        let isValid = true
        
        inputs?.forEach((input) => {
          if (input instanceof HTMLInputElement && !input.checkValidity()) {
            isValid = false
          }
        })
        
        if (isValid && currentStep < totalSteps) {
          currentStep++
          showStep(currentStep)
        }
      },

      prevStep() {
        if (currentStep > 1) {
          currentStep--
          showStep(currentStep)
        }
      },

      handleSubmit(e) {
        e.preventDefault()
        const form = e.target as HTMLFormElement
        
        if (form.checkValidity()) {
          const formData = new FormData(form)
          trigger({ type: 'submit', detail: formData })
        }
      },

      onConnected() {
        showStep(1)
      }
    }
  }
})
```

### Pattern 3: Form with Conditional Fields

```typescript
const ConditionalForm = bElement({
  tag: 'conditional-form',
  shadowDom: (
    <form p-target="form" p-trigger={{ submit: 'handleSubmit' }}>
      <div>
        <label>
          <input
            type="checkbox"
            name="has-phone"
            p-trigger={{ change: 'togglePhone' }}
          />
          I have a phone number
        </label>
      </div>
      
      <div p-target="phoneField" style={{ display: 'none' }}>
        <label htmlFor="phone">Phone number</label>
        <input type="tel" id="phone" name="phone" />
      </div>
      
      <button type="submit">Submit</button>
    </form>
  ),
  bProgram({ $ }) {
    return {
      togglePhone(e) {
        const checkbox = e.target as HTMLInputElement
        const phoneField = $('phoneField')[0] as HTMLElement
        const phoneInput = $<HTMLInputElement>('phone')[0]
        
        if (phoneField && phoneInput) {
          if (checkbox.checked) {
            phoneField.style.display = 'block'
            phoneInput.required = true
          } else {
            phoneField.style.display = 'none'
            phoneInput.required = false
            phoneInput.value = ''
          }
        }
      },

      handleSubmit(e) {
        e.preventDefault()
        const form = e.target as HTMLFormElement
        
        if (form.checkValidity()) {
          const formData = new FormData(form)
          // Handle submission
        }
      }
    }
  }
})
```

## Testing Considerations

### Manual Testing

1. **Keyboard Navigation**: Tab through all fields
2. **Screen Reader**: Test with NVDA/JAWS/VoiceOver
3. **Validation**: Test all error states
4. **Mobile**: Test on actual devices
5. **Browser Compatibility**: Test in all major browsers

### Automated Testing

```typescript
// Example story test
export const formStory = story({
  intent: 'Test form submission with validation',
  template: () => <FormContainer />,
  play: async ({ page, accessibilityCheck }) => {
    await accessibilityCheck({})
    
    // Test validation
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()
    
    // Check for error messages
    const errorMessages = page.locator('[role="alert"]')
    await expect(errorMessages).toHaveCount(1)
    
    // Fill form
    await page.fill('input[name="username"]', 'John Doe')
    await page.fill('input[name="user-mail"]', 'john@example.com')
    await page.fill('input[name="password"]', 'password123')
    
    // Submit again
    await submitButton.click()
    
    // Check for success
    await expect(page.locator('form')).not.toBeVisible()
  }
})
```

## References

- **MDN**: [How to structure a web form](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/How_to_structure_a_web_form)
- **MDN**: [HTML Forms](https://developer.mozilla.org/en-US/docs/Learn/Forms)
- **WAI-ARIA**: [Form Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/form/)
- **Plaited**: See **ui-patterns** skill for Form-Associated Elements and bElement documentation

## Summary

**Key principles:**
- Use semantic HTML (`<form>`, `<fieldset>`, `<legend>`, `<label>`)
- Minimize fields and group logically
- Place labels above inputs
- Use inline validation with clear error messages
- Test for accessibility and mobile compatibility
- Use form-associated bElements for custom controls

**Best practices:**
- One-column layout
- Native input types when possible
- Helper text for format instructions
- Action-oriented button text
- Progress indication for multi-step forms
- Native mobile features (date pickers, etc.)

**Plaited integration:**
- Use bElement for form containers with validation coordination
- Use form-associated bElements for custom form controls
- Leverage `p-trigger` and `p-target` for form interactions
- Use `emit` for cross-element form communication