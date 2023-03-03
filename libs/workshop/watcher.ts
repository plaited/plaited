import { Routes } from '../server/mod.ts'

export const watcher = async ({
  reloadClient,
  routes,
  updateRoutes,
  workspace,
}: {
  reloadClient: () => void
  routes: Routes
  updateRoutes: () => Promise<void>
  workspace: string
}) => {
  const watcher = Deno.watchFs(workspace, { recursive: true })
  for await (const { kind } of watcher) {
    if (kind === 'modify') {
      routes.clear()
      await updateRoutes()
      reloadClient()
    }
  }
}
