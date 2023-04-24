type TokenSets = Array<{
    [key: string]: string | number;
} | undefined | false | null>;
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
export declare const useTokens: (...obj: TokenSets) => readonly [() => {
    [key: string]: string | number;
}, (...tokenSets: TokenSets) => void];
export {};
