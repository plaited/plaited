import { bSync, bThread, type RulesFunction } from 'plaited'
import { bElement } from 'plaited/ui'
import { hostStyles, styles } from './validated-input.css.ts'

type ValidationState = {
  isValid: boolean
  message: string
}

/**
 * Block submit until validation passes.
 * Uses getter to check current validation state at evaluation time.
 */
const requireValidation = (getState: () => ValidationState): RulesFunction =>
  bThread(
    [
      bSync({
        block: ({ type }) => type === 'submit' && !getState().isValid,
      }),
    ],
    true,
  )

/**
 * Sequence: input event triggers validation.
 * This ensures validation runs after every input change.
 */
const validateOnInput = bThread([bSync({ waitFor: 'input' }), bSync({ request: { type: 'validate' } })], true)

export const ValidatedInput = bElement({
  tag: 'validated-input',
  formAssociated: true,
  observedAttributes: ['min-length', 'pattern', 'required'],
  shadowDom: (
    <div {...styles.container}>
      <input
        type='text'
        p-target='input'
        p-trigger={{ input: 'input' }}
        aria-describedby='error'
        {...styles.input}
      />
      <span
        id='error'
        p-target='error'
        role='alert'
        aria-live='polite'
        {...styles.error}
      ></span>
    </div>
  ),
  hostStyles,
  bProgram({ $, bThreads, internals, attr }) {
    const state: ValidationState = { isValid: false, message: '' }
    const getState = () => state
    const minLength = Number(attr['min-length'] ?? 1)

    bThreads.set({
      requireValidation: requireValidation(getState),
      validateOnInput,
    })

    return {
      input(evt: InputEvent) {
        const target = evt.target as HTMLInputElement
        internals.setFormValue(target.value)
      },
      validate() {
        const [input] = $<HTMLInputElement>('input')
        const [error] = $('error')
        const value = input?.value ?? ''

        if (value.length < minLength) {
          state.isValid = false
          state.message = `Must be at least ${minLength} characters`
          internals.setValidity({ tooShort: true }, state.message, input)
          internals.states.delete('valid')
          internals.states.add('invalid')
        } else {
          state.isValid = true
          state.message = ''
          internals.setValidity({})
          internals.states.delete('invalid')
          internals.states.add('valid')
        }
        error?.render(<>{state.message}</>)
      },
      submit() {
        // Only reached if validation passed (bThread allows it)
        const [input] = $<HTMLInputElement>('input')
        return { value: input?.value }
      },
    }
  },
})
