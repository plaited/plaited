import {
  FlexValue, 
  GridValue, 
  TypographyValue, 
  GetFormatter,
} from '../../../types.js'
import { defaultFormat } from './default-format.js'
import { ruleSet } from './rule-set.js'

export const tsTokens: GetFormatter = ({ $type, $value, ...rest }) => [ 'typography', 'grid', 'flex' ].includes($type)
  ? ruleSet({ ...rest, $value: $value as TypographyValue | GridValue | FlexValue })
  : defaultFormat({ ...rest, $value: $value })
