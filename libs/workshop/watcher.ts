import { Watcher } from './types.ts'
import { wait } from '../utils/mod.ts'
export const watcher: Watcher = async ({
  writeFn,
  getRoutes,
  routes,
  workspace,
  ...rest
}) => {
  const watcher = Deno.watchFs(workspace, { recursive: true })
  let lastEvent = ''
  for await (const { kind } of watcher) {
    if (['any', 'access'].includes(kind)) {
      lastEvent = kind
      continue
    }
    if (kind !== lastEvent) {
      const obj = await writeFn()
      await wait(500)
      routes.clear()
      const newRoutes = await getRoutes({
        ...obj,
        ...rest,
      })
      newRoutes.forEach((val, key) => routes.set(key, val))
      lastEvent = kind
    }
  }
}
