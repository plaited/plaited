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

export const tokens = (
  ...objs: Array<{ [key: string]: string | number } | undefined | false | null>
) => {
  const filtered = objs.filter(Boolean)
  const toRet: { [key: string]: string | number } = {}
  Object.assign(toRet, ...filtered)
  for (const key in toRet) {
    toRet[`--${key}`] = toRet[key]
    delete toRet[key]
  }
  return toRet
}
