import { DesignTokenGroup } from '@plaited/token-types'
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
      $description: 'mock description',
    },
    x2: {
      $value: {
        static: 6,
        mobile: 8,
        desktop: 6,
        tv: 8,
      },
      $type: 'dimension',
      $description: 'mock description',
    },
    x3: {
      $value: {
        static: 12,
        mobile: 16,
        desktop: 12,
        tv: 14,
      },
      $type: 'dimension',
      $description: 'mock description',
    },
    s3: {
      $value: 12,
      $type: 'dimension',
      $description: 'mock description',
    },
  },
  backgroundColor: {
    purple: {
      x1: {
        $value: '#4c00b0',
        $type: 'color',
        $description: 'mock description',
      },
      x2: {
        $value: '#7600bc',
        $type: 'color',
        $description: 'mock description',
      },
      x3: {
        $value: '#8a00c2',
        $type: 'color',
        $description: 'mock description',
      },
    },
  },
  borderRadius: {
    x1: { $value: 3, $type: 'dimension', $description: 'mock description' },
    x2: { $value: 5, $type: 'dimension', $description: 'mock description' },
    x3: { $value: 7, $type: 'dimension', $description: 'mock description' },
  },
  fontSize: {
    x1: {
      $value: 14,
      $type: 'dimension',
      $description: 'mock description',
    },
  },
  fontFamily: {
    sansSerif: {
      $value: [ 'Roboto', 'sans-serif' ],
      $type: 'fontFamily',
      $description: 'mock description',
    },
  },
  fontWeight: {
    x1: {
      $value: 700,
      $type: 'fontWeight',
      $description: 'mock description',
    },
  },
  letterSpacing: {
    x1: {
      $value: 'normal',
      $type: 'primitive',
      $description: 'mock description',
    },
  },
  lineHeight: {
    x1: {
      $value: 1,
      $type: 'primitive',
      $description: 'mock description',
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
      $description: 'mock description',
    },
  },
  action: {
    primary: {
      rest: {
        borderRadius: {
          $value: '{borderRadius.x1}',
          $type: 'dimension',
          $description: 'mock description',
        },
        backgroundColor: {
          $value: '{backgroundColor.purple.x2}',
          $type: 'color',
          $description: 'mock description',
        },
        typography: {
          $value: '{typography.x1}',
          $type: 'typography',
          $description: 'mock description',
        },
      },
    },
  },
}
