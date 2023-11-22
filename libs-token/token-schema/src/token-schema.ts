import { DesignTokenGroup } from '@plaited/token-types'
import { parse } from './parse.js'

/**
 * Parses a {@link DesignTokenGroup} group into a JSON schema where the tokens values
 * locked in as const.
 * @param tokens - The design token group to parse.
 * @returns The populated JSON schema.
 */
export const tokenSchema = <T extends DesignTokenGroup = DesignTokenGroup>(tokens: T) => {
  return parse<T>({ tokens })
}
