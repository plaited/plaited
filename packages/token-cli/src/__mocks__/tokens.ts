import { DesignTokenGroup } from '../token-transform-util/types'
export const tokens: DesignTokenGroup = {
  size: {
    x1: {
      $value: {
        static: 2,
        mobile: 2,
        desktop: 2,
        tv: 4,
      },
      $type: 'dimension',
    },
    x2: {
      $value: {
        static: 6,
        mobile: 8,
        desktop: 6,
        tv: 8,
      },
      $type: 'dimension',
    },
    x3: {
      $value: {
        static: 12,
        mobile: 16,
        desktop: 12,
        tv: 14,
      },
      $type: 'dimension',
    },
    s3: {
      $value: 12,
      $type: 'dimension',
    },
  },
  backgroundColor: {
    purple: {
      x1: { $value: '#4c00b0', $type: 'color' },
      x2: { $value: '#7600bc', $type: 'color' },
      x3: { $value: '#8a00c2', $type: 'color' },
    },
  },
  borderRadius: {
    x1: { $value: 3, $type: 'dimension' },
    x2: { $value: 5, $type: 'dimension' },
    x3: { $value: 7, $type: 'dimension' },
  },
  fontSize: {
    x1: {
      $value: 14,
      $type: 'dimension',
    },
  },
  fontFamily: {
    sansSerif: {
      $value: [ 'Roboto', 'sans-serif' ],
      $type: 'fontFamily',
    },
  },
  fontWeight: {
    x1: {
      $value: 700,
      $type: 'fontWeight',
    },
  },
  letterSpacing: {
    x1: {
      $value: 'normal',
      $type: 'primitive',
    },
  },
  lineHeight: {
    x1: {
      $value: 1,
      $type: 'primitive',
    },
  },
  typography: {
    x1: {
      $value: {
        fontFamily: '{fontFamily.sansSerif}',
        fontSize: '{fontSize.x1}',
        fontWeight: '{fontWeight.x1}',
        letterSpacing: '{letterSpacing.x1}',
        lineHeight: '{lineHeight.x1}',
      },
      $type: 'typography',
    },
  },
  action: {
    primary: {
      rest: {
        borderRadius: {
          $value: '{borderRadius.x1}',
          $type: 'dimension',
        },
        backgroundColor: {
          $value: '{backgroundColor.purple.x2}',
          $type: 'color',
        },
        typography: {
          $value: '{typography.x1}',
          $type: 'typography',
        },
      },
    },
  },
}
