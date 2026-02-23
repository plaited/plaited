import { expect, test } from 'bun:test'
import { h } from 'plaited/jsx-runtime'
import { createHostStyles, createSSR, createStyles } from 'plaited/ui'

test('createSSR: Replaces :host{ with :root{ for SSR', () => {
  const hostStyles = createHostStyles({
    color: 'blue',
    padding: '20px',
  })

  const { render } = createSSR()
  const rendered = render(<div {...hostStyles}>Host styles test</div>)

  expect(rendered).not.toContain(':host{')
  expect(rendered).toContain(':root{')
})

test('createSSR: Replaces :host(<selector>) with :root<selector> for SSR', () => {
  const hostStyles = createHostStyles({
    color: {
      $default: 'blue',
      $compoundSelectors: {
        '.dark': 'white',
        '[disabled]': 'gray',
        ':hover': 'lightblue',
      },
    },
  })

  const { render } = createSSR()
  const rendered = render(<div {...hostStyles}>Host selector styles test</div>)

  expect(rendered).not.toContain(':host(')
  expect(rendered).not.toContain(':host.')
  expect(rendered).not.toContain(':host[')
  expect(rendered).not.toContain(':host:')

  expect(rendered).toContain(':root.dark')
  expect(rendered).toContain(':root[disabled]')
  expect(rendered).toContain(':root:hover')
})

test('createSSR: deduplicates styles across renders', () => {
  const stylesA = createStyles({
    box: { color: 'red' },
  })
  const stylesB = createStyles({
    card: { color: 'blue' },
  })

  const { render } = createSSR()

  const first = render(<div {...stylesA.box}>first</div>)
  expect(first).toContain('<style>')

  // Same styles should not be emitted again
  const second = render(<div {...stylesA.box}>second</div>)
  expect(second).not.toContain('<style>')

  // New styles should be emitted
  const third = render(<div {...stylesB.card}>third</div>)
  expect(third).toContain('<style>')
})

test('createSSR: clearStyles resets deduplication', () => {
  const styles = createStyles({
    box: { color: 'red' },
  })

  const { render, clearStyles } = createSSR()

  const first = render(<div {...styles.box}>first</div>)
  expect(first).toContain('<style>')

  clearStyles()

  // After clearing, same styles should be emitted again
  const second = render(<div {...styles.box}>second</div>)
  expect(second).toContain('<style>')
})

test('createSSR: injects styles before </head> when present', () => {
  const styles = createStyles({
    box: { color: 'red' },
  })

  const { render } = createSSR()
  const rendered = render(
    h('html', {
      children: [
        h('head', { children: h('title', { children: 'Test' }) }),
        h('body', { children: h('div', { ...styles.box, children: 'content' }) }),
      ],
    }),
  )

  const headClose = rendered.indexOf('</head>')
  const styleTag = rendered.indexOf('<style>')
  expect(styleTag).toBeLessThan(headClose)
})

test('createSSR: injects styles after <body> when no </head>', () => {
  const styles = createStyles({
    box: { color: 'red' },
  })

  const { render } = createSSR()
  const rendered = render(
    h('body', {
      children: h('div', { ...styles.box, children: 'content' }),
    }),
  )

  const bodyOpen = rendered.indexOf('<body>')
  const styleTag = rendered.indexOf('<style>')
  expect(styleTag).toBeGreaterThan(bodyOpen)
})
