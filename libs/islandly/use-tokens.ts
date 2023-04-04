type TokenSets = Array<
  { [key: string]: string | number } | undefined | false | null
>
/**
 * @param {...{}} objs - object containing camelCased
 * style properties or css custom properties
 * @returns {<{'--prop': 'value'}>} containing prefixed css
 *  custom properties to be inlined.
 * @example Simple
 * <Textblock style={tokens({
 *    lineHeight: 1.2,
 *    fontSize: rem(47.78),
 *  })} />
 * @example Conditional Example
 * <Textblock style={tokens(
 *  inline ? { display: 'inline' } : { display: 'block' },
 *  {
 *    lineHeight: 1.2,
 *    fontSize: rem(47.78),
 *  },
 * )} />
 */
export const useTokens = (
  ...obj: TokenSets
) => {
  let tokenSet: { [key: string]: string | number } = {}
  const set = (...tokenSets: TokenSets) => {
    const nextSet: { [key: string]: string | number } = {}
    const filtered = tokenSets.filter(Boolean)
    Object.assign(nextSet, ...filtered)
    for (const key in nextSet) {
      nextSet[`--${key}`] = nextSet[key]
      delete nextSet[key] // Room for performance fix
    }
    tokenSet = nextSet
  }
  set(...obj)
  const get = () => tokenSet
  return Object.freeze<
    [() => typeof tokenSet, (...tokenSets: TokenSets) => void]
  >([
    get,
    set,
  ])
}
