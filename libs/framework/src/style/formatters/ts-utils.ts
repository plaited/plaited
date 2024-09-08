import type { DesignTokenGroup } from '../types.js'
import { camelCase, kebabCase } from '../../utils.js'
import { resolveAlias } from './resolve-alias.js'
import { prefix } from './constants.js'
export const resolveTSVar = (value: string, allTokens: DesignTokenGroup) => {
  const res = resolveAlias(value, allTokens)
  if (!res) return ''
  const [, path] = res
  return camelCase(path.join(' '))
}

export const isValidAlias = (value: string, allTokens: DesignTokenGroup) => Boolean(resolveAlias(value, allTokens))

export const getCssVar = (tokenPath: string[]) => `"var(--${prefix}-${kebabCase(tokenPath.join(' '))})"`
