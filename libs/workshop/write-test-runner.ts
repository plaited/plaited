import { bundler } from '../bundler/mod.ts'
import { resolve } from '../deps.ts'
import { writeDirectory } from './constants.ts'
import { getStat } from './get-stat.ts'

const __dirname = new URL('.', import.meta.url).pathname
const testRunner = resolve(__dirname, './test-runner.ts')

export const writeTestRunner = async ({ assets }: {
  assets: string
}) => {
  const outdir = `${assets}/${writeDirectory}`
  const out = `${outdir}/test-runner.js`
  const exist = await getStat(out)
  exist && Deno.remove(out)
  const files = await bundler({
    dev: false,
    entryPoints: [testRunner],
  })
  const arr: string[] = []
  await Promise.all(files.map(async ([path, content]) => {
    const mod = `${outdir}${path}`
    arr.push(mod)
    await Deno.writeFile(mod, content)
  }))
  return arr
}
