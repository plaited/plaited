import { Watcher } from './types.ts'
export const watcher: Watcher = async ({
  writeFn,
  getRoutes,
  routes,
  workspace,
  ...rest
}) => {
  const watcher = Deno.watchFs(workspace, { recursive: true })
  for await (const { kind } of watcher) {
    if (kind === 'modify') {
      const obj = await writeFn()
      routes.clear()
      const newRoutes = await getRoutes({
        ...obj,
        ...rest,
      })
      newRoutes.forEach((val, key) => routes.set(key, val))
    }
  }
}
