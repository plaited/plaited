import fg, { Options } from 'fast-glob'
import path from 'path'
import fs from 'fs/promises'
import { importWork } from './import-work.js'
import { cleanup } from './cleanup.js'
import { writeRoutes } from './write-routes.js'
import { Element } from '@plaited/island'

export const workshop = async ({
  input,
  pattern,
  testsDir,
  routesDir,
  options,
  fixtures,
}:{
  input: string
  pattern: string
  entries: string
  testsDir: string
  routesDir: string
  options: Options
  fixtures: { [key: `${string}-${string}`]: Element}
}) => {
  /** get the work paths for each work */
  const workPaths = await fg(path.resolve(input, pattern), options)
  
  /** import work and generate route */
  const works = await Promise.all(workPaths.map(async filePath => {
    const map = await importWork(filePath, fixtures)
    return [ ...map ]
  }))
  const flattenedWorks = works.flatMap(obj => obj)

  /** create routes object */
  writeRoutes(routesDir, flattenedWorks)

  /** cleanup test for works that don't exist */
  const testPaths = await fg(path.resolve(testsDir, `**/*.spec.ts`), options)
  await cleanup(testPaths, flattenedWorks)
}
