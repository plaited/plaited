import { keyMirror } from '../../utils.ts'

/**
 * Reserved style object keys handled specially by the CSS builder.
 *
 * @public
 */
export const CSS_RESERVED_KEYS = keyMirror('$default', '$compoundSelectors')
