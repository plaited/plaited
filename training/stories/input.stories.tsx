import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { inputStyles } from './input.css.ts'

/**
 * Text input field.
 */
const TextInput: FT<{
  placeholder?: string
  disabled?: boolean
  'data-state'?: 'error' | 'success'
}> = ({ placeholder, disabled, 'data-state': state, ...attrs }) => (
  <input
    type='text'
    {...joinStyles(
      inputStyles.input,
      state === 'error' && inputStyles.error,
      state === 'success' && inputStyles.success,
    )}
    placeholder={placeholder}
    disabled={disabled}
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
  <div {...inputStyles.fieldGroup}>
    <label
      {...inputStyles.label}
      htmlFor={id}
    >
      {label}
    </label>
    {children}
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
}> = ({ id, label, errorText, children }) => (
  <div {...inputStyles.fieldGroup}>
    <label
      {...inputStyles.label}
      htmlFor={id}
    >
      {label}
    </label>
    {children}
    <span {...inputStyles.errorText}>{errorText}</span>
  </div>
)

export const meta = {
  title: 'Training/Input',
}

export const basicInput = story({
  intent: 'Create a basic text input field with placeholder text',
  template: () => <TextInput placeholder='Enter your name' />,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const disabledInput = story({
  intent: 'Create a disabled text input that cannot be edited',
  template: () => (
    <TextInput
      placeholder='Cannot edit'
      disabled
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const errorInput = story({
  intent: 'Create a text input showing error validation state',
  template: () => (
    <TextInput
      placeholder='Invalid input'
      data-state='error'
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const successInput = story({
  intent: 'Create a text input showing success validation state',
  template: () => (
    <TextInput
      placeholder='Valid input'
      data-state='success'
    />
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

export const inputWithError = story({
  intent: 'Create a form field showing validation error message',
  template: () => (
    <ErrorField
      id='password-field'
      label='Password'
      errorText='Password must be at least 8 characters'
    >
      <TextInput
        id='password-field'
        placeholder='Enter password'
        data-state='error'
      />
    </ErrorField>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
