import {
  FlexValue,
  GetFormatters,
  GridValue,
  TypographyValue,
} from '../types.ts'
import { defaultFormat } from './default-format.ts'
import { ruleSet } from './rule-set.ts'

/**
 * This formatter object will return formatters that will create content for
 * a treeshakeable mapping to css custom properties references to be used
 * inline styles in ts/js component files
 */
export const defaultTSFormatters: GetFormatters = (
  { $type, $value, ...rest },
) =>
  ['typography', 'grid', 'flex'].includes($type)
    ? ruleSet({
      ...rest,
      $value: $value as TypographyValue | GridValue | FlexValue,
    })
    : defaultFormat({ ...rest, $value: $value })