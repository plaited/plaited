export { CONNECT_PLAITED_ROUTE } from '../../template.constants.ts'

import { CONNECT_PLAITED_ROUTE } from '../../template.constants.ts'
import type { ControllerExtension } from '../../controller.types.ts'

export const bundleController = async () => {
  const entry = CONNECT_PLAITED_ROUTE.replace('.js', '.ts')
  const controllerEntry = Bun.resolveSync('../../controller.ts', import.meta.dir)
  const entrySource = `
import { Controller } from ${JSON.stringify(controllerEntry)}

const params = new URL(import.meta.url).searchParams
const agentCard = JSON.parse(params.get('agentCard') ?? 'null')
if (!agentCard) throw new Error('Controller bundle: missing agentCard param')

// Load optional extension modules specified as comma-separated paths.
// Each module must export:
//   - key: the p-trigger pair string this extension handles (e.g. "click:my_action")
//   - default: a ControllerExtension function
const modulePaths = (params.get('modules') ?? '').split(',').map(function(s) { return s.trim() }).filter(Boolean)
const extEntries = await Promise.all(modulePaths.map(async function(path) {
  const mod = await import(path)
  if (typeof mod.key !== 'string') {
    throw new Error(
      'Extension module "' + path + '" is missing a string key export. ' +
      'Each extension module must export a key string (e.g. "click:my_action").'
    )
  }
  if (typeof mod.default !== 'function') {
    throw new Error(
      'Extension module "' + path + '" has invalid default export. ' +
      'Expected a function, got ' + typeof mod.default + '.'
    )
  }
  return [mod.key, mod.default]
}))
const extensions = new Map(extEntries)

const controller = new Controller({ agentCard, extensions })
controller.connect()
`
  const { outputs, logs, success } = await Bun.build({
    entrypoints: [entry],
    files: {
      [entry]: entrySource,
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