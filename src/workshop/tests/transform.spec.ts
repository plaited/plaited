import { expect, test } from 'bun:test'
import { transform } from '../transform-local-file'
test('transform', async () => {
  const expected = `import { h } from "plaited/jsx-runtime"
export const Button = () => h("button", {
  children: "Click me"
}, undefined, false, undefined, this);\n`
  const path = Bun.resolveSync(`.${'/src/workshop/tests/eg.js'}`, process.cwd())
  const actual = await transform(path)
  expect(actual).toBe(expected)
})
