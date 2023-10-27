const escapeRegex = (str: string) =>
  str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

export const match = (str: string) => (pattern: string | RegExp) => {
  const RE = new RegExp(
    typeof pattern === 'string' ? escapeRegex(pattern) : pattern
  )
  const matched = str.match(RE)
  return matched ? matched[0] : ''
}
