import { BaseAttrs, PlaitedElement, Template } from './create-template.ts'

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
// deno-lint-ignore no-explicit-any
export const memo = <T extends Record<string, any> = Record<string, any>>(
  resultFn: PlaitedElement<T>,
): PlaitedElement<T> => {
  let cache: {
    lastThis: ThisParameterType<typeof resultFn>
    lastProps: T & BaseAttrs
    lastResult: ReturnType<typeof resultFn>
  } | null = null
  function tpl(
    this: ThisParameterType<typeof resultFn>,
    props: Parameters<typeof resultFn>[0],
  ): Template {
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
  // tpl.styles = new Set<string>()
  return tpl
}
