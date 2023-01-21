import fg, { Options } from 'fast-glob'
import path from 'path'
import { importWork } from './import-work.js'
export const workshop = async ({
  input,
  pattern,
  tests,
  output,
  options,
}:{
  input: string
  pattern: string
  entries: string
  tests: string
  output: string
  options: Options
}) => {
  const workPaths = await fg(path.resolve(input, pattern), options)
  const resolved = await Promise.all(workPaths.map(async filePath => {
    return await importWork(filePath)
  }))

}
