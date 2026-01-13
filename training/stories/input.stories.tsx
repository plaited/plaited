import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { inputStyles, tokenStyles } from './input.css.ts'

/**
 * Text input field.
 */
const TextInput: FT<{
  id?: string
  placeholder?: string
  disabled?: boolean
  'data-state'?: 'error' | 'success' | 'warning'
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling'
  'aria-errormessage'?: string
}> = ({
  id,
  placeholder,
  disabled,
  'data-state': state,
  'aria-invalid': ariaInvalid,
  'aria-errormessage': ariaErrorMessage,
  ...attrs
}) => (
  <input
    type='text'
    id={id}
    {...joinStyles(
      tokenStyles,
      inputStyles.input,
      state === 'error' && inputStyles.error,
      state === 'success' && inputStyles.success,
      state === 'warning' && inputStyles.warning,
    )}
    placeholder={placeholder}
    disabled={disabled}
    aria-invalid={ariaInvalid ?? (state === 'error' ? 'true' : undefined)}
    aria-errormessage={ariaErrorMessage}
    {...attrs}
  />
)

/**
 * Form field with label and help text.
 */
const LabeledField: FT<{
  id: string
  label: string
  helpText: string
}> = ({ id, label, helpText, children }) => (
  <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
    <label
      {...inputStyles.label}
      htmlFor={id}
    >
      {label}
    </label>
    <div id={id}>{children}</div>
    <span {...inputStyles.helpText}>{helpText}</span>
  </div>
)

/**
 * Form field with label and error text.
 */
const ErrorField: FT<{
  id: string
  label: string
  errorText: string
  placeholder?: string
  disabled?: boolean
}> = ({ id, label, errorText, placeholder, disabled }) => {
  const errorMessageId = `${id}-error`
  return (
    <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
      <label
        {...inputStyles.label}
        htmlFor={id}
      >
        {label}
      </label>
      <TextInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        data-state='error'
        aria-invalid='true'
        aria-errormessage={errorMessageId}
      />
      <span
        id={errorMessageId}
        {...inputStyles.errorText}
        role='alert'
        aria-atomic='true'
      >
        {errorText}
      </span>
    </div>
  )
}

export const meta = {
  title: 'Training/Input',
}

export const basicInput = story({
  intent: 'Create a basic text input field with label and placeholder text',
  template: () => (
    <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
      <label
        {...inputStyles.label}
        htmlFor='basic-input'
      >
        Name
      </label>
      <TextInput
        id='basic-input'
        placeholder='Enter your name'
      />
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const disabledInput = story({
  intent: 'Create a disabled text input that cannot be edited',
  template: () => (
    <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
      <label
        {...inputStyles.label}
        htmlFor='disabled-input'
      >
        Disabled Field
      </label>
      <TextInput
        id='disabled-input'
        placeholder='Cannot edit'
        disabled
      />
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const errorInput = story({
  intent: 'Create a text input showing error validation state',
  template: () => {
    const errorMessageId = 'error-input-error'
    return (
      <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
        <label
          {...inputStyles.label}
          htmlFor='error-input'
        >
          Email Address
        </label>
        <TextInput
          id='error-input'
          placeholder='email@example.com'
          data-state='error'
          aria-invalid='true'
          aria-errormessage={errorMessageId}
        />
        <span
          id={errorMessageId}
          {...inputStyles.errorText}
          role='alert'
          aria-atomic='true'
        >
          Please enter a valid email address
        </span>
      </div>
    )
  },
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const successInput = story({
  intent: 'Create a text input showing success validation state',
  template: () => (
    <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
      <label
        {...inputStyles.label}
        htmlFor='success-input'
      >
        Username
      </label>
      <TextInput
        id='success-input'
        placeholder='Enter username'
        data-state='success'
      />
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const warningInput = story({
  intent: 'Create a text input showing warning validation state',
  template: () => (
    <div {...joinStyles(tokenStyles, inputStyles.fieldGroup)}>
      <label
        {...inputStyles.label}
        htmlFor='warning-input'
      >
        Password
      </label>
      <TextInput
        id='warning-input'
        placeholder='Enter password'
        data-state='warning'
      />
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const labeledInput = story({
  intent: 'Create a form field with label, input, and help text',
  template: () => (
    <LabeledField
      id='email-field'
      label='Email Address'
      helpText="We'll never share your email"
    >
      <TextInput
        id='email-field'
        placeholder='email@example.com'
      />
    </LabeledField>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const labeledInputWithError = story({
  intent: 'Create a form field showing validation error message',
  template: () => (
    <ErrorField
      id='password-field'
      label='Password'
      errorText='Password must be at least 8 characters'
      placeholder='Enter password'
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
