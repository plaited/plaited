/* eslint-disable no-console */
import fg from 'fast-glob'
import path from 'path'
import { writeSpec } from './write-spec.js'
import { writeRegistry } from './write-registry.js'
import { writeWorks } from './write-works.js'
import { WorkshopConfig } from '../types.js'
import { getSpecData } from './get-spec-data.js'

export const write = async ({
  source,
  workPattern,
  fixturePattern,
  tests,
  port,
}:WorkshopConfig) => {
  /** get fixture paths for each fixture */
  const fixturePaths = await fg(path.resolve(source, fixturePattern))
  
  /** write registry file*/
  await writeRegistry(fixturePaths, source)
  
  /** get the work paths for each work */
  const workPaths = await fg(path.resolve(source, workPattern))

  /** get work data */
  const specData = await getSpecData({
    port,
    source,
    tests,
    workPaths,
  })
  
  /** write spec files */
  const testFiles = await Promise.all(specData.map(async data => {
    return await writeSpec(data)
  }))
  
  /** write route files */
  const workFiles = await writeWorks(workPaths)

  return { testFiles, specData, workFiles }
}
