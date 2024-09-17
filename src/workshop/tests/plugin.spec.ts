// import { expect, test } from 'bun:test'
// import { workshopPlugin } from '../plugin.js'

// test('workshopPlugin', async () => {
//   console.log(Bun.resolveSync('./__mocks__/template.tsx', import.meta.dir))
//   const { logs, outputs, success } = await Bun.build({
//     entrypoints: [
//       Bun.resolveSync('./__mocks__/template.tsx', import.meta.dir),
//       Bun.resolveSync('./__mocks__/worker.tsx', import.meta.dir)
//     ],
//     plugins: [workshopPlugin],
//   })
//   console.log(logs)
//   expect(success).toBeTrue()
//   expect(outputs.length).toBe(1)
//   const blob = outputs[0]
//   const text = await blob.text()
//   expect(text).toBe('js')
// })
