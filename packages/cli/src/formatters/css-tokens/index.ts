import { FormatterObject } from '../../types'
import { alignItems } from './align-items.js'
import { border } from './border.js'
import { color } from './color.js'
import { cubicBezier } from './cubic-bezier.js'
import { dimension } from './dimension.js'
import { displayFlex } from './display-flex.js'
import { distributeContent } from './distribute-content.js'
import { duration } from './duration.js'
import { flex } from './flex.js'
import { flexDisplay } from './flex-display.js'
import { flexDirection } from './flex-direction.js'
import { flexWrap } from './flex-wrap.js'
import { fontFamily } from './font-family.js'
import { fontSize } from './font-size.js'
import { fontStyle } from './font-style.js'
import { fontWeight } from './font-weight.js'
import { gap } from './gap.js'
import { gradient } from './gradient.js'
import { grid } from './grid.js'
import { gridAuto } from './grid-auto.js'
import { gridAutoFlow } from './grid-auto-flow.js'
import { gridDisplay } from './grid-display.js'
import { gridTemplate } from './grid-template.js'
import { letterSpacing } from './letter-spacing.js'
import { lineHeight } from './line-height.js'
import { percentage } from './percentage.js'
import { primitive } from './primitive.js'
import { shadow } from './shadow.js'
import { strokeStyle } from './stroke-style.js'
import { textDecoration } from './textDecoration.js'
import { textTransform } from './textTransformation.js'
import { transition } from './transition.js'
import { typography } from './typography.js'

export const cssTokens: FormatterObject = {
  alignItems,
  border,
  color,
  cubicBezier,
  dimension,
  displayFlex,
  distributeContent,
  duration,
  flex,
  flexDisplay,
  flexDirection,
  flexWrap,
  fontFamily,
  fontSize,
  fontStyle,
  fontWeight,
  gap,
  gradient,
  grid,
  gridAuto,
  gridAutoFlow,
  gridDisplay,
  gridTemplate,
  letterSpacing,
  lineHeight,
  primitive,
  percentage,
  shadow,
  strokeStyle,
  textDecoration,
  textTransform,
  transition,
  typography,
}
