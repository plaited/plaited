import { PREFERS_COLOR_SCHEME_QUERIES } from './styling.constants'
import type {
  MediaQueries,
  PrefersColorSchemeQueries,
  CreatePropsParams,
  PropGetters,
  PropSetters,
} from './styling.types'

export const createProps = <P extends CreatePropsParams>({ $mediaQueries, ...props }: P) => {
  const queries: typeof $mediaQueries extends Record<string, string> ?
    MediaQueries<typeof $mediaQueries> & PrefersColorSchemeQueries
  : PrefersColorSchemeQueries = {
    ...PREFERS_COLOR_SCHEME_QUERIES,
  }
  if ($mediaQueries) {
    for (const key in $mediaQueries) {
      queries[key] = `@${$mediaQueries[key]}`
    }
  }
  const getters: PropGetters<P> = {}
  const setters: PropSetters<P> = {}
  return [getters, setters]
}
