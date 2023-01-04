import {
  BorderValue, 
  DimensionValue, 
  FlexValue, 
  FontFamilyValue, 
  GradientValue, 
  GridValue, 
  ShadowValue, 
  TransitionValue, 
  TypographyValue, 
  PrimitiveValue, 
  PrimitiveArrayValue,
} from '../../types.js'
import { GetFormatter } from '../../types'
import { border } from './border.js'
import { dimension } from './dimension.js'
import { flex } from './flex.js'
import { fontFamily } from './font-family.js'
import { gradient } from './gradient.js'
import { grid } from './grid.js'
import { primitive } from './primitive.js'
import { shadow } from './shadow.js'
import { transition } from './transition.js'
import { typography } from './typography.js'

export const jsRaw: GetFormatter = ({ $type, $value, ...rest }) => $type === 'border'
  ? border({ ...rest, $value: $value as BorderValue })
  : $type === 'dimension'
  ? dimension({ ...rest, $value: $value as DimensionValue })
  : $type === 'flex'
  ? flex({ ...rest, $value: $value as FlexValue })
  : $type === 'fontFamily'
  ? fontFamily({ ...rest, $value: $value as FontFamilyValue })
  : $type === 'gradient'
  ? gradient({ ...rest, $value: $value as GradientValue })
  : $type === 'grid'
  ? grid({ ...rest, $value: $value as GridValue })
  : $type === 'shadow'
  ? shadow({ ...rest, $value: $value as ShadowValue })
  : $type === 'transition'
  ? transition({ ...rest, $value: $value as TransitionValue })
  : $type === 'typography'
  ? typography({ ...rest, $value: $value as TypographyValue })
  : primitive({ ...rest, $value: $value as PrimitiveValue | PrimitiveArrayValue })
