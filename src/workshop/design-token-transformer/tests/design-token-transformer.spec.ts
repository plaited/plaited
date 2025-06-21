import { test, expect, jest } from 'bun:test'
import * as prettier from 'prettier'
import { type DesignTokenGroup } from '../design-token-transformer.types.js'
import { TransformDesignTokens } from '../design-token-transformer.js'

test('Token no group', async () => {
  const tokens = { $value: '45deg', $type: 'angle', $description: 'mock description' }
  const { css, ts } = new TransformDesignTokens({
    //@ts-expect-error: should gracefully fail
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toBe('')
  expect(ts).toBe('')
})

test('Empty tokens group', async () => {
  const tokens = {}
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toBe('')
  expect(ts).toBe('')
})

test('Empty nested token group', async () => {
  const tokens = {
    colors: {},
  }
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toBe('')
  expect(ts).toBe('')
})

test('Single Token in group', async () => {
  const tokens: DesignTokenGroup = {
    single: { $value: '45deg', $type: 'angle', $description: 'mock description' },
  }
  const { css, ts, entries } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
  expect(entries.length).toBe(1)
})

test('Nested token group (2 levels)', async () => {
  const tokens: DesignTokenGroup = {
    one: {
      two: { $value: '20%', $type: 'amount', $description: 'mock description' },
    },
  }
  const { css, ts, entries } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
  expect(entries.length).toBe(1)
})

test('Color hex', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      white: {
        1: {
          $value: '#fff',
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
  }
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('mediaQueries: screen', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      100: {
        $value: {
          '@desktop': '3rem',
          '@tv': '4rem',
          '@mobile': '2rem',
        },
        $type: 'size',
        $description: 'mock description',
      },
    },
  }
  const { ts, css } = new TransformDesignTokens({
    tokens,
    defaultMediaQueries: {
      screen: '@mobile',
    },
    mediaQueries: new Map([
      ['@mobile', 'screen and (max-width: 767px)'],
      ['@desktop', 'screen and (min-width: 1024px)'],
      ['@tv', 'screen and (min-width: 1920px)'],
    ]),
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('mediaQueries:m colorScheme', async () => {
  const tokens: DesignTokenGroup = {
    gray: {
      $value: {
        '@dark': {
          l: '0%',
          c: 0,
          h: 0,
          a: 0.5,
        },
        '@light': {
          l: '100%',
          c: 0,
          h: 0,
          a: 0.5,
        },
      },
      $type: 'color',
      $description: 'mock description',
    },
  }
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('mediaQueries', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        100: {
          $value: {
            '@tv': '4rem',
            '@mobile': '2rem',
            '@desktop': '3rem',
          },
          $type: 'size',
          $description: 'mock description',
        },
      },
    },
    colors: {
      background: {
        primary: {
          $value: {
            '@light': {
              l: '100%',
              c: 0,
              h: 0,
              a: 0.5,
            },
            '@dark': {
              l: '0%',
              c: 0,
              h: 0,
              a: 0.5,
            },
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
  }
  const { css, ts } = new TransformDesignTokens({
    tokens,
    mediaQueries: new Map([
      ['@mobile', 'screen and (max-width: 767px)'],
      ['@desktop', 'screen and (min-width: 1024px)'],
      ['@tv', 'screen and (min-width: 1920px)'],
    ]),
    defaultMediaQueries: {
      colorScheme: '@dark',
      screen: '@mobile',
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
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('alias + mediaQueries', async () => {
  const tokens: DesignTokenGroup = {
    colors: {
      white: {
        100: {
          $value: '#fff',
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
            '@light': '{colors.white.100}',
            '@dark': '{colors.charcoal.100}',
          },
          $type: 'color',
          $description: 'mock description',
        },
      },
    },
  }
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('function tokens', async () => {
  const tokens: DesignTokenGroup = {
    gradient: {
      primary: {
        $value: {
          function: 'linear-gradient',
          arguments: ['45deg', '{gradient.stop.1}', '{gradient.stop.2}'],
        },
        $type: 'function',
        $description: 'mock description',
        $csv: true,
      },
      stop: {
        1: {
          $value: ['{gradient.color.1}', '20%'],
          $description: 'mock description',
        },
        2: {
          $value: ['{gradient.color.2}', '80%'],
          $description: 'mock description',
        },
      },
      color: {
        1: {
          $value: {
            l: '0%',
            c: 0,
            h: 0,
            a: 0.5,
          },
          $type: 'color',
          $description: 'mock description',
        },
        2: {
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
  }
  const { css, ts } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
})

test('camelCases keys when generating alias', async () => {
  const tokens: DesignTokenGroup = {
    gradient: {
      stop: {
        1: {
          $value: ['{gradient.color.1}', '20%'],
          $description: 'mock description',
        },
        2: {
          $value: ['{gradient.color.2}', '80%'],
          $description: 'mock description',
        },
      },
      Color: {
        1: {
          $value: {
            l: '0%',
            c: 0,
            h: 0,
            a: 0.5,
          },
          $type: 'color',
          $description: 'mock description',
        },
        2: {
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
  }
  const { entries } = new TransformDesignTokens({
    tokens,
  })

  expect(entries.length).toBe(4)
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
  new TransformDesignTokens({
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
            '@desktop': 2,
          },
          $type: 'size',
          $description: 'mock description',
          //@ts-ignore: it exist
        },
      },
    },
  }
  console.error = jest.fn()
  new TransformDesignTokens({
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
            '@tv': '4rem',
          },
          $type: 'size',
          $description: 'mock description',
        },
      },
    },
  }
  console.error = jest.fn()
  new TransformDesignTokens({
    tokens,
    mediaQueries: new Map([
      ['@mobile', 'screen and (max-width: 767px)'],
      ['@desktop', 'screen and (min-width: 1024px)'],
    ]),
  })
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`[tv] not found in mediaQueries`)
  })
})

test('Invalid top level group name', async () => {
  const tokens: DesignTokenGroup = {
    1: {
      2: { $value: '20%', $type: 'amount', $description: 'mock description' },
    },
  }
  console.error = jest.fn()
  new TransformDesignTokens({
    tokens,
  })
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`Rename top level token group [1]. Top level keys cannot start with a number.`)
  })
})

test('query methods', async () => {
  const tokens: DesignTokenGroup = {
    gradient: {
      color: {
        1: {
          $value: {
            l: '0%',
            c: 0,
            h: 0,
            a: 0.5,
          },
          $type: 'color',
          $description: 'mock description',
        },
        2: {
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
      stop: {
        1: {
          $value: ['{gradient.color.1}', '20%'],
          $description: 'mock description',
        },
        2: {
          $value: ['{gradient.color.2}', '80%'],
          $description: 'mock description',
        },
      },
      primary: {
        $value: {
          function: 'linear-gradient',
          arguments: ['45deg', '{gradient.stop.1}', '{gradient.stop.2}'],
        },
        $type: 'function',
        $description: 'mock description',
        $csv: true,
      },
    },
  }
  const { filter, get, has, entries } = new TransformDesignTokens({
    tokens,
  })
  expect(has('{gradient.color.1}')).toBe(true)
  expect(has('{gradient.color.3}')).toBe(false)
  expect(has('{gradient.stop.1}')).toBe(true)
  expect(has('{gradient.stop.11}')).toBe(false)
  expect(get('{gradient.primary}')).toMatchSnapshot('single gradient token')
  const filterEntries = filter(([, entry]) => entry.$type === 'color')
  expect(filterEntries.length).toBe(2)
  expect(filterEntries).toMatchSnapshot('color token only')
  expect(entries).toMatchSnapshot('all tokens')
})

test('fractional scale', async () => {
  const tokens: DesignTokenGroup = {
    size: {
      0: { $value: '0rem', $type: 'size', $description: 'mock description' },
      '0.5': { $value: '0.125rem', $type: 'size', $description: 'mock description' },
      1: { $value: '0.25rem', $type: 'size', $description: 'mock description' },
      '1.5': { $value: '0.375rem', $type: 'size', $description: 'mock description' },
      2: { $value: '0.5rem', $type: 'size', $description: 'mock description' },
      '2.5': { $value: '0.5rem', $type: 'size', $description: 'mock description' },
      3: { $value: '0.75rem', $type: 'size', $description: 'mock description' },
      '3.5': { $value: '0.875rem', $type: 'size', $description: 'mock description' },
      4: { $value: '1rem', $type: 'size', $description: 'mock description' },
    },
    paddingSmall: { $value: '{size.0_5}', $type: 'size', $description: 'mock description' },
    bodyFont: {
      $type: 'composite',
      $description: 'mock description',
      $value: {
        lineHeight: '{size.4}',
        fontSize: '{size.3_5}',
      },
    },
  }
  const { css, ts, entries } = new TransformDesignTokens({
    tokens,
  })
  const prettyCSS = await prettier.format(css, { parser: 'css' })
  expect(prettyCSS).toMatchSnapshot()
  expect(ts).toMatchSnapshot()
  expect(entries).toMatchSnapshot('fractional scale entries')
})

test('Throw on circular dependency', async () => {
  const tokens: DesignTokenGroup = {
    circular: {
      $value: '{dependent}',
      $type: 'color',
      $description: 'mock description',
    },
    white: {
      $value: '{circular}',
      $type: 'color',
      $description: 'mock description',
    },
    dependent: {
      $value: '{white}',
      $type: 'color',
      $description: 'mock description',
    },
  }
  const t = () => {
    new TransformDesignTokens({
      tokens,
    })
  }
  try {
    t()
  } catch (e) {
    //@ts-expect-error: it's an error
    expect(e?.message).toBe(`Circular dependency found for {circular}\ndependencyPath: [{dependent}, {white}]`)
  }
})
