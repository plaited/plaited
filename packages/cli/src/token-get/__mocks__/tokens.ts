import { DesignTokenGroup } from '../../types.js'
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
  fontSize: {
    1: {
      $value: 14,
      $type: 'fontSize',
    },
  },
  fontFamily: {
    sansSerif: {
      $value: 'Roboto',
      $type: 'fontFamily',
    },
  },
  fontWeight: {
    1: {
      $value: 700,
      $type: 'fontWeight',
    },
  },
  letterSpacing: {
    1: {
      $value: 'normal',
      $type: 'letterSpacing',
    },
  },
  lineHeight: {
    1: {
      $value: 1,
      $type: 'lineHeight',
    },
  },
  typography: {
    1: {
      $value: {
        fontFamily: '{fontFamily.sansSerif}',
        fontSize: '{fontSize.1}',
        fontWeight: '{fontWeight.1}',
        letterSpacing: '{letterSpacing.1}',
        lineHeight: '{lineHeight.1}',
      },
      $type: 'typography',
    },
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
        typography: {
          $value: '{typography.1}',
          $type: 'typography',
        },
      },
    },
  },
}
