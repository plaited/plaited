import { createStyles, joinStyles } from 'plaited/ui'
import { inputTokens } from './input.tokens.ts'

export const inputStyles = createStyles({
  input: {
    display: 'block',
    inlineSize: '100%',
    paddingBlock: '8px',
    paddingInline: '12px',
    fontSize: '16px',
    lineHeight: '1.5',
    borderRadius: '4px',
    border: {
      $default: `1px solid ${inputTokens.border.default()}`,
      ':focus': `1px solid ${inputTokens.border.focus()}`,
    },
    backgroundColor: {
      $default: inputTokens.background.default,
      '[disabled]': inputTokens.background.disabled,
    },
    color: {
      $default: inputTokens.text.default,
      '[disabled]': inputTokens.text.disabled,
    },
    outline: {
      $default: 'none',
      ':focus': `0 0 0 3px rgba(0, 123, 255, 0.25)`,
    },
    transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
  },
  error: {
    border: `1px solid ${inputTokens.border.error()}`,
    outline: {
      ':focus': `0 0 0 3px rgba(220, 53, 69, 0.25)`,
    },
  },
  success: {
    border: `1px solid ${inputTokens.border.success()}`,
    outline: {
      ':focus': `0 0 0 3px rgba(40, 167, 69, 0.25)`,
    },
  },
  label: {
    display: 'block',
    marginBlockEnd: '4px',
    fontWeight: '500',
    fontSize: '14px',
    color: '#212529',
  },
  helpText: {
    display: 'block',
    marginBlockStart: '4px',
    fontSize: '12px',
    color: '#6c757d',
  },
  errorText: {
    display: 'block',
    marginBlockStart: '4px',
    fontSize: '12px',
    color: '#dc3545',
  },
  fieldGroup: {
    marginBlockEnd: '16px',
  },
})

export const tokenStyles = joinStyles(
  inputTokens.border.default,
  inputTokens.border.focus,
  inputTokens.border.error,
  inputTokens.border.success,
  inputTokens.background.default,
  inputTokens.background.disabled,
  inputTokens.text.default,
  inputTokens.text.disabled,
)
