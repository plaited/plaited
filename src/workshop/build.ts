import { TEMPLATE_FILTER_REGEX, SERVER_TEMPLATE_NAMESPACE } from './workshop.constants.js'
import { scanTemplateImports } from './scan.js'

export const build = async ({ root, entries = [], cwd }: { root: string; entries?: string[]; cwd: string }) => {
  return await Bun.build({
    root,
    entrypoints: [Bun.resolveSync('./use-play.tsx', import.meta.dir), ...entries],
    splitting: true,
    sourcemap: 'inline',
    plugins: [
      {
        name: 'workshop-plugin',
        setup({ onResolve, onLoad }) {
          onResolve(
            {
              filter: TEMPLATE_FILTER_REGEX,
              namespace: 'entry-point',
            },
            (args) => {
              return { path: args.path, namespace: SERVER_TEMPLATE_NAMESPACE }
            },
          )
          onLoad(
            {
              filter: /\.*/,
              namespace: SERVER_TEMPLATE_NAMESPACE,
            },
            async ({ path }) => {
              const contents = await scanTemplateImports(cwd, path)
              return { contents, loader: 'tsx' }
            },
          )
        },
      },
    ],
  })
}
