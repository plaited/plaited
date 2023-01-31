/* eslint-disable no-console */
// import fg from 'fast-glob'
// import path from 'path'
// import { writeSpec } from './write-spec.ts'
// import { writeRegistry } from './write-registry.ts'
// import { writeWorks } from './write-works.ts'
// import { WorkshopConfig } from '../types.ts'
// import { getSpecData } from './get-spec-data.ts'
import string from 'https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/string'
import { fs, isGlob, globToRegExp } from '../../deps.ts'
export const write = async ({
  assets,
  exts
}: {
  assets: string
  exts: {
    fixture: string | string[],
    story: string | string[]
  }
}) => {
  const { fixture, story } = exts

  /** get paths and name for each fixture */
  const fixtures: {
    name: string,
    path: string
  }[] = []
  for await (const entry of walk(assets, { exts: Array.isArray(fixture) ? fixture : [fixture]})) {
    const {name, path} = entry
    fixtures.push({ name, path})
  }

  /** get paths and name for each set of stories */
  const stories: {
    name: string,
    path: string
  }[] = []
  for await (const entry of walk(assets, { exts: Array.isArray(story) ? fixture : [story]})) {
    const {name, path} = entry
    fixtures.push({ name, path})
  }
  
  /** write registry file*/
  await writeRegistry(fixtures, assets)
  
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
