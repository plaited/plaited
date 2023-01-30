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
} from '../../token-types.ts'
import { border } from './border.ts'
import { dimension } from './dimension.ts'
import { fontFamily } from './font-family.ts'
import { gradient } from './gradient.ts'
import { defaultFormat } from './default-format.ts'
import { dropShadow } from './drop-shadow.ts'
import { transition } from './transition.ts'
import { nullFormat } from './null-format.ts'
import { gridTemplate } from './grid-template.ts'
import { gap } from './gap.ts'

/**
 * This formatter object will return formatters that will create content for an
 * optimized css stylesheet of css custom properties to be applied to :root
 */
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
