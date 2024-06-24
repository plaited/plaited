import { test, expect, jest } from 'bun:test'
import * as prettier from 'prettier'

import { transformToCSS } from '../transform-to-css.js'
import { transformToTS } from '../transform-to-ts.js'
import { DesignTokenGroup } from '../types.js'

test('empty token group', async () => {
  const tokens = {
    colors: {},
  }
  const css = transformToCSS({
    tokens,
  })
  const ts = transformToTS({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toBe('')
  expect(ts).toBe('')
})

test('token group', async () => {
  const tokens: DesignTokenGroup = {
    lineHeight: {
      xxs: { $value: '0.25rem', $type: 'size', $description: 'mock description' },
    },
  }
  const css = transformToCSS({
    tokens,
  })
  const ts = transformToTS({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('nested token group', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      gray: {
        10: {
          $value: {
            l: '97.91%',
            c: 0,
            h: 0,
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
  }
  const css = transformToCSS({
    tokens,
  })
  const ts = transformToTS({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('context: [media-query]', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        100: {
          $value: {
            desktop: '3rem',
            tv: '4rem',
            mobile: '2rem',
          },
          $type: 'size',
          $description: 'mock description',
          $extensions: {
            plaited: {
              context: 'media-query',
            },
          },
        },
      },
    },
  }
  const css = transformToCSS({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: 'screen and (min-width: 1024px)',
        tv: 'screen and (min-width: 1920px)',
        mobile: 'screen and (max-width: 767px)',
      },
    },
  })
  const ts = transformToTS({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: 'screen and (min-width: 1024px)',
        tv: 'screen and (min-width: 1920px)',
        mobile: 'screen and (max-width: 767px)',
      },
    },
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('context: [color-scheme]', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      background: {
        primary: {
          $value: {
            light: {
              l: '100%',
              c: 0,
              h: 0,
              a: 0.5,
            },
            dark: {
              l: '0%',
              c: 0,
              h: 0,
              a: 0.5,
            },
          },
          $type: 'color',
          $extensions: {
            plaited: {
              context: 'color-scheme',
            },
          },
          $description: 'mock description',
        },
      },
    },
  }
  const css = transformToCSS({
    tokens,
    contexts: {
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const ts = transformToTS({
    tokens,
    contexts: {
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('context: [media-query, color-scheme]', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        100: {
          $value: {
            tv: '4rem',
            mobile: '2rem',
            desktop: '3rem',
          },
          $type: 'size',
          $description: 'mock description',
          $extensions: { plaited: { context: 'media-query' } },
        },
      },
    },
    colors: {
      background: {
        primary: {
          $value: {
            light: {
              l: '100%',
              c: 0,
              h: 0,
              a: 0.5,
            },
            dark: {
              l: '0%',
              c: 0,
              h: 0,
              a: 0.5,
            },
          },
          $type: 'color',
          $extensions: { plaited: { context: 'color-scheme' } },
          $description: 'mock description',
        },
      },
    },
  }
  const css = transformToCSS({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: 'screen and (min-width: 1024px)',
        mobile: 'screen and (max-width: 767px)',
        tv: 'screen and (min-width: 1920px)',
      },
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const ts = transformToTS({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: 'screen and (min-width: 1024px)',
        mobile: 'screen and (max-width: 767px)',
        tv: 'screen and (min-width: 1920px)',
      },
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('alias', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      gray: {
        100: {
          $value: {
            l: '98.21%',
            c: 0,
            h: 0,
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
    surface: {
      secondary: {
        100: {
          $value: '{colors.gray.100}',
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
  }
  const css = transformToCSS({
    tokens,
  })
  const ts = transformToTS({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('alias + context', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      white: {
        100: {
          $value: {
            l: '97.91%',
            c: 0,
            h: 0,
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
      charcoal: {
        100: {
          $value: {
            l: '18.31%',
            c: 0.004,
            h: 285.99,
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
    surface: {
      secondary: {
        100: {
          $value: {
            light: '{colors.white.100}',
            dark: '{colors.charcoal.100}',
          },
          $type: 'color',
          $description: 'mock description',
          $extensions: { plaited: { context: 'color-scheme' } },
        },
      },
    },
  }
  const css = transformToCSS({
    tokens,
    contexts: {
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const ts = transformToTS({
    tokens,
    contexts: {
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('exercise token types', async () => {
  const tokens: DesignTokenGroup = {
    fontWeight: { $value: 700, $description: 'mock description', $type: undefined },
    letterSpacing: {
      $value: 'normal',
      $description: 'mock description',
    },
    fontSize: {
      $value: '14px',
      $type: 'size',
      $description: 'mock description',
    },
    lineHeight: {
      $value: 1.5,
      $description: 'mock description',
    },
    typography: {
      $value: {
        fontFamily: '{fontFamily}',
        fontSize: '{fontSize}',
        fontWeight: '{fontWeight}',
        letterSpacing: '{letterSpacing}',
        lineHeight: '{lineHeight}',
      },
      $type: 'composite',
      $description: 'mock description',
    },
    gradient: {
      $value: {
        gradientFunction: 'linear-gradient',
        angleShapePosition: '45deg',
        colorStops: [
          {
            color: {
              l: '0%',
              c: 0,
              h: 0,
              a: 0.5,
            },
            position: '20%',
          },
          {
            color: {
              l: '100%',
              c: 0,
              h: 0,
              a: 0.5,
            },
            position: '80%',
          },
        ],
      },
      $type: 'gradient',
      $description: 'mock description',
    },
    fontFamily: {
      $value: ['Roboto', 'sans-serif'],
      $description: 'mock description',
      $extensions: { plaited: { commaSeparated: true } },
    },
    arrayOfSizes: {
      $value: ['60px', '60px'],
      $type: 'size',
      $description: 'mock description',
    },
    string: {
      $value: 'primitive string',
      $description: 'mock description',
    },
    number: {
      $value: 50,
      $description: 'mock description',
    },
  }
  const css = transformToCSS({
    tokens,
    contexts: {
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const ts = transformToTS({
    tokens,
    contexts: {
      colorSchemes: {
        light: 'light',
        dark: 'dark',
      },
    },
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('invalid alias', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      white: {
        100: {
          $value: {
            l: '100%',
            c: 0,
            h: 0,
            a: 0.5,
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
    surface: {
      secondary: {
        100: {
          $value: '{colors.white.200}',
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
  }
  console.error = jest.fn()
  transformToCSS({
    tokens,
  })
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`Invalid token alias: {colors.white.200}`)
  })
})

test('invalid context', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        //@ts-expect-error: it exist
        '1': {
          $value: {
            desktop: 2,
          },
          $type: 'size',
          $description: 'mock description',
          //@ts-ignore: it exist
          $extensions: { plaited: { context: 'media' } },
        },
      },
    },
  }
  transformToCSS({
    tokens,
  })
  console.error = jest.fn()
  transformToCSS({
    tokens,
  })
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`Context type [media] is an invalid context type`)
  })
})

test('invalid context key', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        '1': {
          $value: {
            tv: '4rem',
          },
          $type: 'size',
          $description: 'mock description',
          $extensions: { plaited: { context: 'media-query' } },
        },
      },
    },
  }
  console.error = jest.fn()
  transformToCSS({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: 'screen and (min-width: 1024px)',
        mobile: 'screen and (max-width: 767px)',
      },
    },
  })
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`[tv] not found in mediaQueries`)
  })
})
