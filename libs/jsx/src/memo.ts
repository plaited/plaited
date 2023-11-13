import { dataTrigger } from './constants.js'
import { CreateTemplate, Template, Attrs } from './types.js'
import { deepEqual } from '@plaited/utils'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shallowCompare = (obj1: Attrs = {}, obj2: Attrs = {}) => {
  const keys = Object.keys(obj1)
  const length = keys.length
  if (length !== Object.keys(obj2).length) return false
  const objAttrs = new Set<string>(['style', 'children', dataTrigger, 'dataTrigger'])
  for (let i = 0; i < length; i++) {
    const key = keys[i]
    if (!Object.hasOwn(obj2, key)) return false
    if (objAttrs.has(key)) return deepEqual(obj1[key], obj2[key])
    if (obj1[key] !== obj2[key]) return false
  }
  return true
}
/**
 * Forked from  memoize-one
 * (c) Alexander Reardon - MIT
 * {@see https://github.com/alexreardon/memoize-one}
 * In this mode we constrain arguments to a single props object that extends TemplateProps
 * We also do a basic shallow comparison on the object to cache function result.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memo = (resultFn: CreateTemplate): CreateTemplate=> {
  let cache: {
    lastThis: ThisParameterType<typeof resultFn>
    lastTag: Parameters<typeof resultFn>[0]
    lastAttrs: Parameters<typeof resultFn>[1]
    lastResult: ReturnType<typeof resultFn>
  } | null = null
  function tpl(
    this: ThisParameterType<typeof resultFn>,
    tag: Parameters<typeof resultFn>[0],
    attrs: Parameters<typeof resultFn>[1],
  ): Template {
    if (cache && cache.lastThis === this && cache.lastTag === tag && shallowCompare(attrs, cache.lastAttrs)) {
      return cache.lastResult
    }
    const lastResult = resultFn.call(this, tag, attrs)
    cache = {
      lastResult,
      lastTag: tag,
      lastAttrs: attrs,
      lastThis: this,
    }
    return lastResult
  }
  return tpl
}
