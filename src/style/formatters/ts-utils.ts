import type { DesignTokenGroup } from '../token.types.ts'
import { camelCase, kebabCase } from '../../utils/case.ts'
import { resolveAlias } from './resolve-alias.ts'
import { prefix } from './formatters.constants.ts'
export const resolveTSVar = (value: string, allTokens: DesignTokenGroup) => {
  const res = resolveAlias(value, allTokens)
  if (!res) return ''
  const [, path] = res
  return camelCase(path.join(' '))
}

export const isValidAlias = (value: string, allTokens: DesignTokenGroup) => Boolean(resolveAlias(value, allTokens))

export const getCssVar = (tokenPath: string[]) => `"var(--${prefix}-${kebabCase(tokenPath.join(' '))})"`
