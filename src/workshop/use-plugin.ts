import { BunPlugin } from 'bun'
import { STORY_FILTER_REGEX, STORY_NAMESPACE } from './workshop.constants.js'

export const usePlugin = (virtualEntries: Map<string, string>): BunPlugin => ({
  name: 'workshop-plugin',
  setup({ onResolve, onLoad }) {
    onResolve(
      {
        filter: STORY_FILTER_REGEX,
      },
      (args) => {
        return { path: args.path, namespace: STORY_NAMESPACE }
      },
    )
    onLoad(
      {
        filter: /\.*/,
        namespace: STORY_NAMESPACE,
      },
      ({ path }) => {
        const contents = virtualEntries.get(path)
        if (!contents) {
          throw new Error(`Could not find virtual module ${path}`)
        }
        return { contents, loader: 'tsx' }
      },
    )
  },
})
