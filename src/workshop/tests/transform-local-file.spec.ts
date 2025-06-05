import { expect, test } from 'bun:test'
import { transformLocalFile } from '../transform-local-file.js'

const dec = new TextDecoder()

test('transform: tsx', async () => {
  const expected = `import { h } from "plaited/jsx-runtime"
export const Button = () => h("button", {
  children: "Click me"
}, undefined, false, undefined, this);\n`
  const path = Bun.resolveSync(`.${'/src/workshop/tests/mocks/jsx.js'}`, process.cwd())
  const res = await transformLocalFile(path)
  const buff = await res.bytes()
  const uncompressed = Bun.gunzipSync(buff)
  const actual = dec.decode(uncompressed)
  expect(actual).toBe(expected)
})

test('transform: ts', async () => {
  const expected = 'export const Button = (arg) => console.log(arg);\n'
  const path = Bun.resolveSync(`.${'/src/workshop/tests/mocks/js.js'}`, process.cwd())
  const res = await transformLocalFile(path)
  const buff = await res.bytes()
  const uncompressed = Bun.gunzipSync(buff)
  const actual = dec.decode(uncompressed)
  expect(actual).toBe(expected)
})
