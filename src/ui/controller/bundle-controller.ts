import { CONNECT_PLAITED_ROUTE } from '../render/template.constants.ts'

export const bundleController = async () => {
  const entry = CONNECT_PLAITED_ROUTE.replace('.js', '.ts')
  const controllerEntry = Bun.resolveSync('./use-controller.ts', import.meta.dir)
  const { outputs, logs, success } = await Bun.build({
    entrypoints: [entry],
    files: {
      [entry]: `
      import { useController } from ${JSON.stringify(controllerEntry)}

      const Controller = useController()
      const params = new URL(import.meta.url).searchParams
      const tags = (params.get('registry') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      for (const tag of tags) {
        if (!customElements.get(tag)) customElements.define(tag, Controller)
      }
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
