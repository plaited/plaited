import type { ContextTypes, Contexts, DesignToken, StaticToken, BaseToken, ContextualToken } from '../token.types.js'

export const isValidContext = ({
  ctx,
  contexts: { colorSchemes, mediaQueries },
}: {
  ctx: { type: ContextTypes; id: string }
  contexts: Contexts
}) => {
  const { type, id } = ctx
  const obj =
    type === 'color-scheme' ? colorSchemes
    : type === 'media-query' ? mediaQueries
    : 'invalid context type'
  if (typeof obj === 'string') {
    console.error(`Context type [${type}] is an ${obj}`)
    return false
  }
  if (!Object.hasOwn(obj, id)) {
    const context = type === 'color-scheme' ? `colorSchemes` : `mediaQueries`
    console.error(`[${id}] not found in ${context}`)
    return false
  }
  return true
}

export const isStaticToken = <T extends DesignToken>(
  token: BaseToken<T['$value'], T['$type']>,
): token is StaticToken<T['$value'], T['$type']> => !token?.$extensions?.plaited?.context

export const isContextualToken = <T extends DesignToken>(
  token: BaseToken<T['$value'], T['$type']>,
): token is ContextualToken<T['$value'], T['$type']> => Boolean(token?.$extensions?.plaited?.context)
