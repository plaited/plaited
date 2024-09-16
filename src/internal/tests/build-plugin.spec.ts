import { expect, test } from 'bun:test'
import { buildPlugin } from '../build-plugin.js'

const entries = new Map([
  ['batman.plaited', 'export default "batman"'],
  ['src/robin.plaited', 'export const name = "robin"'],
  ['re-export.plaited', `export { name } from "${import.meta.dir}/__mock__/real-module.ts"`],
])

//@ts-expect-error: testing virtual module
Bun.plugin(buildPlugin(entries))

test('string - default export', async () => {
  //@ts-expect-error: testing virtual module
  const { default: mod } = await import('batman.plaited')
  expect(mod).toBe('batman')
})

test('string - named exports', async () => {
  //@ts-expect-error: testing virtual module
  const { name } = await import('src/robin.plaited')
  expect(name).toBe('robin')
})

test('re-export real module', async () => {
  //@ts-expect-error: testing virtual module
  const { name } = await import('re-export.plaited')
  expect(name).toBe('Anthony Stark')
})
