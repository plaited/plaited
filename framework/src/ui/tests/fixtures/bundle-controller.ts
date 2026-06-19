export { CONNECT_PLAITED_ROUTE } from '../../template.constants.ts'

import { CONNECT_PLAITED_ROUTE } from '../../template.constants.ts'

export const bundleController = async () => {
  const entry = CONNECT_PLAITED_ROUTE.replace('.js', '.ts')
  const controllerEntry = Bun.resolveSync('../../controller.ts', import.meta.dir)
  const { outputs, logs, success } = await Bun.build({
    entrypoints: [entry],
    files: {
      [entry]: `
      import { Controller } from ${JSON.stringify(controllerEntry)}

      const params = new URL(import.meta.url).searchParams
      const agentCard = JSON.parse(params.get('agentCard') ?? 'null')
      if (!agentCard) throw new Error('Controller bundle: missing agentCard param')
      // Load optional modules specified as comma-separated paths
      const modulePaths = (params.get('modules') ?? '').split(',').map(s => s.trim()).filter(Boolean)
      const modules = await Promise.all(modulePaths.map(async (path) => {
        const mod = await import(path)
        return mod.default
      }))

      const controller = new Controller({ agentCard, modules })
      controller.connect()
      `,
    },
    minify: true,
    target: 'browser',
  })
  if (!success) {
    throw new AggregateError(logs, 'Failed to build Plaited controller runtime')
  }
  const artifact = outputs[0]!
  const content = await artifact.text()
  const compressed = Bun.gzipSync(content)
  return {
    [CONNECT_PLAITED_ROUTE]: new Response(compressed as BodyInit, {
      headers: new Headers({
        'content-type': artifact?.type,
        'content-encoding': 'gzip',
      }),
    }),
  }
}
