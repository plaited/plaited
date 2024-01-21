import { DesignTokenGroup } from '@plaited/token-types'
export const tokens: DesignTokenGroup = {
  size: {
    x1: {
      $value: {
        tv: 4,
        mobile: 2,
        desktop: 2,
      },
      $type: 'dimension',
      $description: 'mock description',
      $extensions: { 'plaited-context': 'media-query' },
    },
    x2: {
      $value: {
        desktop: 6,
        mobile: 8,
        tv: 8,
      },
      $type: 'dimension',
      $extensions: { 'plaited-context': 'media-query' },
      $description: 'mock description',
    },
    x3: {
      $value: {
        desktop: 12,
        tv: 14,
        mobile: 16,
      },
      $type: 'dimension',
      $extensions: { 'plaited-context': 'media-query' },
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
        $value: {
          l: '39%',
          c: 0.22184604903824146,
          h: 289.1379241925685,
        },
        $type: 'color',
        $description: 'mock description',
      },
      x2: {
        $value: {
          l: '45.38%',
          c: 0.236,
          h: 304.59,
        },
        $type: 'color',
        $description: 'mock description',
      },
      x3: {
        $value: {
          l: '48.67%',
          c: 0.245,
          h: 310.63,
        },
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
      $value: ['Roboto', 'sans-serif'],
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
