export type TemplateProps = {
  className?: string
  htmlFor?: string
  for?: never
  class?: never
  [key: string]: unknown
}

export interface Template<T extends TemplateProps = TemplateProps> {
  (this: unknown, props: T & TemplateProps): string
  styles: Set<string>
}

const shallowCompare = (
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
) =>
  Object.keys(obj1).length === Object.keys(obj2).length &&
  Object.keys(obj1).every((key) =>
    Object.hasOwn(obj2, key) && obj1[key] === obj2[key]
  )
/**
 * Forked from https://github.com/alexreardon/memoize-one
 * In this mode we constrain arguments to a single props object that extends TemplateProps
 * We also do a basic shallow comparison on the object to cache function result.
 */
export const template = <Props extends TemplateProps = TemplateProps>(
  resultFn: (this: unknown, props: Props & TemplateProps) => string,
): Template<Props> => {
  let cache: {
    lastThis: ThisParameterType<typeof resultFn>
    lastProps: Props & TemplateProps
    lastResult: ReturnType<typeof resultFn>
  } | null = null
  function tpl(
    this: ThisParameterType<typeof resultFn>,
    props: Parameters<typeof resultFn>[0],
  ): string {
    if (
      cache && cache.lastThis === this && shallowCompare(props, cache.lastProps)
    ) {
      return cache.lastResult
    }
    const lastResult = resultFn.call(this, props)
    cache = {
      lastResult,
      lastProps: props,
      lastThis: this,
    }
    return lastResult
  }
  tpl.styles = new Set<string>()
  return tpl
}
