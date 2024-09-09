import { expect, test } from 'bun:test'
import { virtualModule } from '../virtual-module.js'

Bun.plugin(virtualModule({
  'batman.js': 'export default "batman"',
  'src/robin.js': 'export const name = "robin"',
  'user.js': {
    name: 'Anthony Stark'
  }
}))

test('string - default export', async () => {
  //@ts-expect-error: testing virtual module
  const { default: mod } = await import('batman.js');
  expect(mod).toBe('batman')
})

test('string - named exports', async () => {
  //@ts-expect-error: testing virtual module
  const { name } = await import('src/robin.js');
  expect(name).toBe('robin')
})

test('object', async () => {
  //@ts-expect-error: testing virtual module
  const { name } = await import('user.js');
  expect(name).toBe('Anthony Stark')
})