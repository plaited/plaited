export { CONNECT_ONBRAID_ROUTE } from '../../template.constants.ts'

import { CONNECT_ONBRAID_ROUTE } from '../../template.constants.ts'

export const bundleController = async () => {
  const entry = CONNECT_ONBRAID_ROUTE.replace('.js', '.ts')
  const controllerEntry = Bun.resolveSync('../../controller.ts', import.meta.dir)
  const { outputs, logs, success } = await Bun.build({
    entrypoints: [entry],
    files: {
      [entry]: `
      import { useController } from ${JSON.stringify(controllerEntry)}

      const params = new URL(import.meta.url).searchParams
      const tag = (params.get('registry') ?? '').trim()
      if (!tag) throw new Error('Controller bundle: missing registry param (tag name)')
      // Load optional Register modules specified as comma-separated paths
      const modulePaths = (params.get('modules') ?? '').split(',').map(s => s.trim()).filter(Boolean)
      const registers = await Promise.all(modulePaths.map(async (path) => {
        const mod = await import(path)
        return mod.default
      }))

      if (!customElements.get(tag)) {
        useController({
          tag,
          registry: registers,
          agentCardId: params.get('agentCardId') ?? undefined,
        })
      }
      `,
    },
    minify: true,
    target: 'browser',
  })
  if (!success) {
    throw new AggregateError(logs, 'Failed to build OnBraid controller runtime')
  }
  const artifact = outputs[0]!
  const content = await artifact.text()
  const compressed = Bun.gzipSync(content)
  return {
    [CONNECT_ONBRAID_ROUTE]: new Response(compressed as BodyInit, {
      headers: new Headers({
        'content-type': artifact?.type,
        'content-encoding': 'gzip',
      }),
    }),
  }
}
