import { test, expect } from 'bun:test'
import { type DesignTokenGroup } from 'plaited/workshop'
import { getDesignTokensSchema } from '../get-design-tokens-schema.js'

export const tokens: DesignTokenGroup = {
  size: {
    x1: {
      $value: {
        '@tv': '4rem',
        '@mobile': '2rem',
        '@desktop': '2rem',
      },
      $type: 'size',
      $description: 'mock description',
    },
    x2: {
      $value: {
        '@desktop': '6rem',
        '@mobile': '8rem',
        '@tv': '8rem',
      },
      $type: 'size',
      $description: 'mock description',
    },
    x3: {
      $value: {
        '@desktop': '12rem',
        '@tv': '14rem',
        '@mobile': '16rem',
      },
      $type: 'size',
      $description: 'mock description',
    },
    s3: {
      $value: '12rem',
      $type: 'size',
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
    x1: { $value: '3rem', $type: 'size', $description: 'mock description' },
    x2: { $value: '5rem', $type: 'size', $description: 'mock description' },
    x3: { $value: '7rem', $type: 'size', $description: 'mock description' },
  },
  fontSize: {
    x1: {
      $value: '14rem',
      $type: 'size',
      $description: 'mock description',
    },
  },
  fontFamily: {
    sansSerif: {
      $value: ['Roboto', 'sans-serif'],
      $description: 'mock description',
      $csv: true,
    },
  },
  fontWeight: {
    x1: {
      $value: 700,
      $description: 'mock description',
    },
  },
  letterSpacing: {
    x1: {
      $value: 'normal',
      $description: 'mock description',
    },
  },
  lineHeight: {
    x1: {
      $value: 1,
      $type: undefined,
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
      $type: 'composite',
      $description: 'mock description',
    },
  },
  action: {
    primary: {
      rest: {
        borderRadius: {
          $value: '{borderRadius.x1}',
          $type: 'size',
          $description: 'mock description',
        },
        backgroundColor: {
          $value: '{backgroundColor.purple.x2}',
          $type: 'color',
          $description: 'mock description',
        },
        typography: {
          $value: '{typography.x1}',
          $type: 'composite',
          $description: 'mock description',
        },
      },
    },
  },
}

const actual = getDesignTokensSchema(tokens)

test('parse(): snapshot', () => {
  expect(actual).toMatchSnapshot()
})
test('parse(): verify required props', () => {
  //@ts-ignore: it exist
  const expected = Object.keys(tokens.size.x1.$value)
  expect(actual?.properties?.size?.properties?.x1?.properties?.$value?.required).toEqual(expected)
})
test('parse(): verify const props', () => {
  //@ts-ignore: it exi st
  const expected = tokens.backgroundColor.purple.x1.$value

  const value = actual?.properties?.backgroundColor?.properties?.purple?.properties?.x1.properties?.$value?.properties
  expect({ l: value?.l?.const, c: value?.c?.const, h: value?.h?.const }).toEqual(expected)
})
test('parse(): handles arrays', () => {
  // @ts-ignore: it exist
  const expected = tokens.fontFamily.sansSerif.$value.map((str: string) => ({
    const: str,
    type: 'string',
  }))
  expect(actual?.properties?.fontFamily?.properties?.sansSerif?.properties?.$value?.items).toEqual(expected)
})
