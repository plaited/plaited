import { PlaitedElement, Template, dataTrigger, Attrs } from '@plaited/jsx'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shallowCompare = <T extends Record<string, any> = Record<string,any>>(
  obj1: Attrs<T>,
  obj2: Attrs<T>
) => {
  const { style:style1 = {}, [dataTrigger]: trigger1 = {}, ...rest1 } = obj1
  const { style:style2 = {}, [dataTrigger]: trigger2 = {}, ...rest2 } = obj2
  const sameStyles = shallowCompare(style1, style2)
  const sameTriggers = shallowCompare(trigger1, trigger2)
  if(!sameStyles || !sameTriggers) return false  
  return Object.keys(rest1).length === Object.keys(rest2).length &&
  Object.keys(rest1).every(key =>
    Object.hasOwn(rest2, key) && rest1[key] === rest2[key]
  )
}
/**
 * Forked from  memoize-one
 * (c) Alexander Reardon - MIT
 * {@see https://github.com/alexreardon/memoize-one}
 * In this mode we constrain arguments to a single props object that extends TemplateProps
 * We also do a basic shallow comparison on the object to cache function result.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memo = <T extends Record<string, any> = Record<string, any>>(
  resultFn: PlaitedElement<T>
): PlaitedElement<T> => {
  let cache: {
    lastThis: ThisParameterType<typeof resultFn>;
    lastProps:Attrs<T>;
    lastResult: ReturnType<typeof resultFn>;
  } | null = null
  function tpl(
    this: ThisParameterType<typeof resultFn>,
    props: Parameters<typeof resultFn>[0]
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
  return tpl
}
