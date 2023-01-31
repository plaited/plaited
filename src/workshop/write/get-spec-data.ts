import { WorksConfig } from '../types.ts'
export const getSpecData = async ({
  port,
  source,
  tests,
  workPaths,
}:{
  port: number
  source: string
  tests: string
  workPaths: string[]
}) => {
  const workDataSets = await Promise.all(workPaths.map(async work => {
    const { default: config, ...rest } = await import(work)
    const { title, fixture } = config as WorksConfig
    const toRet = []
    for(const name in rest) {
      toRet.push({
        title,
        fixture,
        name,
        port,
        work: path.relative(tests, work),
        output: `${tests}/${path.dirname(work).replace(source, '')}`,
      })
    }
    return toRet
  }))
  /** Flatten work data sets */
  return workDataSets.flatMap(data => data)
}
