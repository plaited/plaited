import { createTokens } from 'plaited/ui'

export const { input: inputTokens } = createTokens('input', {
  border: {
    default: { $value: '#ced4da' },
    focus: { $value: '#80bdff' },
    error: { $value: '#dc3545' },
    success: { $value: '#28a745' },
    warning: { $value: '#ffc107' },
  },
  background: {
    default: { $value: '#ffffff' },
    disabled: { $value: '#e9ecef' },
  },
  text: {
    default: { $value: '#495057' },
    placeholder: { $value: '#6c757d' },
    disabled: { $value: '#6c757d' },
  },
})
