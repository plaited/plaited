/**
 * @module css.errors
 *
 * Shared error classes for CSS utils. Exported from a single file to avoid
 * duplicate-export ambiguity when re-exported via client.ts.
 */

import { isTypeOf } from '../utils.ts'

/**
 * Thrown when an unknown CSS property name is encountered.
 */
export class InvalidPropertyNameError extends Error {
  override name = 'invalid_property_name'
  constructor(prop: string) {
    super(`Unknown CSS property name: ${JSON.stringify(prop)}`)
  }
}

/**
 * Thrown when a CSS property value fails validation against its schema.
 */
export class InvalidPropertyValueError extends Error {
  override name = 'invalid_property_value'
  constructor(prop: string, value: unknown) {
    const valStr = isTypeOf<{ toString: () => string }>(value, 'object') ? JSON.stringify(value) : `${value}`
    super(`Invalid value for CSS property ${JSON.stringify(prop)}: ${valStr}`)
  }
}

/**
 * Thrown when a $ref is encountered but no registry was provided.
 */
export class MissingRegistryError extends Error {
  override name = 'missing_registry'
  constructor(refKind: string, refId: string) {
    super(`Cannot resolve $${refKind} "${refId}": no registry provided`)
  }
}

/**
 * Thrown when a $tokenRef id is not found in the registry.
 */
export class UnresolvedTokenRefError extends Error {
  override name = 'unresolved_token_ref'
  constructor(refId: string) {
    super(`Cannot resolve $tokenRef "${refId}": not found in registry`)
  }
}

/**
 * Thrown when a $keyframeRef id is not found in the registry.
 */
export class UnresolvedKeyframeRefError extends Error {
  override name = 'unresolved_keyframe_ref'
  constructor(refId: string) {
    super(`Cannot resolve $keyframeRef "${refId}": not found in registry`)
  }
}

/**
 * Thrown when a $keyframeRef appears under a non-animation property.
 */
export class InvalidKeyframeRefPositionError extends Error {
  override name = 'invalid_keyframe_ref_position'
  constructor(prop?: string) {
    super(
      prop
        ? `$keyframeRef is only legal in animation/animation-name values, found under ${JSON.stringify(prop)}`
        : '$keyframeRef is not legal inside keyframes (keyframes define animations, they do not reference other keyframes)',
    )
  }
}
