import { expect, test } from 'bun:test'
import * as esbuild from 'esbuild'
// import { workshopPlugin } from '../plugin.js'

test('workshopPlugin', async () => {
  console.log(Bun.resolveSync('./__mocks__/template.tsx', import.meta.dir))
  // const { metafile, errors } =   await esbuild.build({
  //   entryPoints: [
  //     Bun.resolveSync('./__mocks__/template.tsx', import.meta.dir),
  //     Bun.resolveSync('./__mocks__/worker.tsx', import.meta.dir)
  //   ],
  //   format: 'esm',
  //   minify: process.env.NODE_ENV === 'production',
  //   outdir: '.',
  //   write: false,
  //   bundle: true,
  //   absWorkingDir: Bun.resolveSync('./__mocks__', import.meta.dir),
  //   sourcemap: process.env.NODE_ENV === 'production' ? undefined : 'inline',
  //   splitting: true,
  //   target: 'browser',
  // })
  

  console.log(metafile)
  // expect(success).toBeTrue()
  // expect(outputs.length).toBe(1)
  // const blob = outputs[0]
  // const text = await blob.text()
  // expect(text).toBe('js')
})
