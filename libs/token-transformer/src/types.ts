import { $FormatterValue, DesignTokenGroup } from '@plaited/token-types'

export type Formatter<T = $FormatterValue> = (args: {
  tokenPath: string[];
  $value: T;
  allTokens: DesignTokenGroup;
  baseFontSize: number;
}) => string;


export type GetFormatters = <
  T extends DesignTokenGroup = DesignTokenGroup,
  F extends $FormatterValue = $FormatterValue,
>(args: {
  tokenPath: string[];
  $value: F;
  allTokens: T;
  baseFontSize: number;
  $type: string;
}) => string;

export type TransformerParams = {
  /** an object of the type {@link DesignTokenGroup} */
  tokens: DesignTokenGroup;
  /** used for rem calculation default 20 */
  baseFontSize?: number;
  /** extend token formatters by passing in custom formatter */
  formatters?: GetFormatters;
}
