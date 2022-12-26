import { FormatterObject } from '../../types'
import { border } from './border.js'
import { color } from './color.js'
import { cubicBezier } from './cubic-bezier.js'
import { dimension } from './dimension.js'
import { duration } from './duration.js'
import { flex } from './flex.js'
import { fontFamily } from './font-family.js'
import { fontSize } from './font-size.js'
import { fontStyle } from './font-style.js'
import { fontWeight } from './font-weight.js'
import { gradient } from './gradient.js'
import { grid } from './grid.js'
import { letterSpacing } from './letter-spacing.js'
import { lineHeight } from './line-height.js'
import { number } from './number.js'
import { percentage } from './percentage.js'
import { shadow } from './shadow.js'
import { strokeStyle } from './stroke-style.js'
import { transition } from './transition.js'
import { typography } from './typography.js'

export const cssTokens: FormatterObject = {
  border,
  color,
  cubicBezier,
  dimension,
  duration,
  flex,
  fontFamily,
  fontSize,
  fontStyle,
  fontWeight,
  gradient,
  grid,
  letterSpacing,
  lineHeight,
  number,
  percentage,
  shadow,
  strokeStyle,
  transition,
  typography,
}
