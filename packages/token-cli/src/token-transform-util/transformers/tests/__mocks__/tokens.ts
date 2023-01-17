import { DesignTokenGroup } from '../../../types.js'
export const tokens:DesignTokenGroup = {
  'background-color': {
    purple: {
      1: { $value: '#4c00b0', $type: 'color' },
      2: { $value: '#7600bc', $type: 'color' },
      3: { $value: '#8a00c2', $type: 'color' },
    },
  },
  'border-radius': {
    1: { $value: 3, $type: 'dimension' },
    2: { $value: 5, $type: 'dimension' },
    3: { $value: 7, $type: 'dimension' },
  },
  action: {
    primary: {
      rest: {
        'border-radius': {
          $value: '{border-radius.1}',
          $type: 'dimension',
        },
        'background-color': {
          $value: '{background-color.2}',
          $type: 'color',
        },
      },
    },
  },
}
