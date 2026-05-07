import { expect, test } from 'bun:test'
import { h } from 'plaited/jsx-runtime'
import { createHostStyles, createStyles, ssr } from 'plaited/ui'

test('ssr: Replaces :host{ with :root{ for SSR', () => {
  const hostStyles = createHostStyles({
    color: 'blue',
    padding: '20px',
  })

  const rendered = ssr([<div {...hostStyles}>Host styles test</div>])

  expect(rendered).not.toContain(':host{')
  expect(rendered).toContain(':root{')
})

test('ssr: Replaces :host(<selector>) with :root<selector> for SSR', () => {
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

  const rendered = ssr([<div {...hostStyles}>Host selector styles test</div>])

  expect(rendered).not.toContain(':host(')
  expect(rendered).not.toContain(':host.')
  expect(rendered).not.toContain(':host[')
  expect(rendered).not.toContain(':host:')

  expect(rendered).toContain(':root.dark')
  expect(rendered).toContain(':root[disabled]')
  expect(rendered).toContain(':root:hover')
})

test('ssr: deduplicates repeated styles within a render', () => {
  const stylesA = createStyles({
    box: { color: 'red' },
  })

  const rendered = ssr([<div {...stylesA.box}>first</div>, <div {...stylesA.box}>second</div>])
  expect(rendered).toContain('<style>')
  expect(rendered.match(/color:red/g)?.length).toBe(1)
})

test('ssr: injects styles before </head> when present', () => {
  const styles = createStyles({
    box: { color: 'red' },
  })

  const rendered = ssr([
    h('html', {
      children: [
        h('head', { children: h('title', { children: 'Test' }) }),
        h('body', { children: h('div', { ...styles.box, children: 'content' }) }),
      ],
    }),
  ])

  const headClose = rendered.indexOf('</head>')
  const styleTag = rendered.indexOf('<style>')
  const connectScript = rendered.indexOf('<script')
  expect(styleTag).toBeLessThan(headClose)
  expect(connectScript).toBeGreaterThan(styleTag)
  expect(connectScript).toBeLessThan(headClose)
})

test('ssr: injects styles after <body> when no </head>', () => {
  const styles = createStyles({
    box: { color: 'red' },
  })

  const rendered = ssr([
    h('body', {
      children: h('div', { ...styles.box, children: 'content' }),
    }),
  ])

  const bodyOpen = rendered.indexOf('<body>')
  const styleTag = rendered.indexOf('<style>')
  const connectScript = rendered.indexOf('<script')
  expect(styleTag).toBeGreaterThan(bodyOpen)
  expect(connectScript).toBeGreaterThan(styleTag)
})

test('ssr: injects an async module connect script with deduplicated registry tags', () => {
  const rendered = ssr([
    h('sample-element', { children: 'first' }),
    h('sample-element', { children: 'second' }),
    h('other-element', { children: 'third' }),
  ])

  expect(rendered).toContain('<script ')
  expect(rendered).toContain('src="/.plaited/connect.js?registry=sample-element%2Cother-element"')
  expect(rendered).toContain('type="module"')
  expect(rendered).toContain('async')
  expect(rendered).not.toContain(',src=')
})
