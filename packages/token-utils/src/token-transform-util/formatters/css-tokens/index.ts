import {
  BorderValue, 
  DimensionValue, 
  FontFamilyValue, 
  GradientValue, 
  DropShadowValue, 
  TransitionValue, 
  PrimitiveValue, 
  PrimitiveArrayValue,
  GetFormatter,
  GridTemplateValue,
  GapValue,
} from '../../../types.js'
import { border } from './border.js'
import { dimension } from './dimension.js'
import { fontFamily } from './font-family.js'
import { gradient } from './gradient.js'
import { defaultFormat } from './default-format.js'
import { dropShadow } from './drop-shadow.js'
import { transition } from './transition.js'
import { nullFormat } from './null-format.js'
import { gridTemplate } from './grid-template.js'
import { gap } from './gap.js'

export const cssTokens: GetFormatter = ({ $type, $value, ...rest }) => $type === 'border'
  ? border({ ...rest, $value: $value as BorderValue })
  : [ 'dimension', 'lineHeight', 'letterSpacing', 'fontSize' ].includes($type)
  ? dimension({ ...rest, $value: $value as DimensionValue })
  : $type === 'fontFamily'
  ? fontFamily({ ...rest, $value: $value as FontFamilyValue })
  : $type === 'gradient'
  ? gradient({ ...rest, $value: $value as GradientValue })
  : $type === 'shadow'
  ? dropShadow({ ...rest, $value: $value as DropShadowValue })
  : $type === 'transition'
  ? transition({ ...rest, $value: $value as TransitionValue })
  : $type === 'gap'
  ? gap({ ...rest, $value: $value as GapValue })
  : $type === 'gridTemplate'
  ? gridTemplate({ ...rest, $value: $value as GridTemplateValue })
  : [ 'typography' , 'grid' , 'flex' ].includes($type)
  ? nullFormat()
  : defaultFormat({ ...rest, $value: $value as PrimitiveValue | PrimitiveArrayValue })
