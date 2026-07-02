import { keyMirror } from '../utils.ts'

/**
 * Reserved style object keys handled specially by the CSS builder.
 *
 * @public
 */
export const CSS_RESERVED_KEYS = keyMirror('$default', '$compoundSelectors', '$host', '$root', '$top')

/**
 * Pattern matching a token reference embedded in a CSS value.
 * Agent-inserted comment markers: `/* token <id> *​/`
 *
 * @public
 */
export const TOKEN_REF_PATTERN = /\/\*\s*token\s+(\S+)\s*\*\//

/**
 * Pattern matching a keyframe reference embedded in a CSS value.
 * Agent-inserted comment markers: `/* keyframe <id> *​/`
 *
 * @public
 */
export const KEYFRAME_REF_PATTERN = /\/\*\s*keyframe\s+(\S+)\s*\*\//
