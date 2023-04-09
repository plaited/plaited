// deno-lint-ignore-file no-explicit-any
import { PlaitedElement } from './create-template.ts'

type ExtractObjectType<T extends Array<any>> = T extends Array<infer U>
  ? (U extends Record<string, unknown> ? U : never)
  : never
type ElementType<T> = T extends Record<string, any>[] ? ExtractObjectType<T> : T

export type Render<T> = (next: T) => void

type DataUpdate<T> = (
  data: T,
) => T

export type Update<T> = (
  callback: DataUpdate<T>,
) => void

export const getContent = (
  data: Record<string, any> | Record<string, any>[],
  element: PlaitedElement,
) => {
  const template = document.createElement('template')
  template.innerHTML = Array.isArray(data)
    ? data.map((obj) => element(obj).content).join('')
    : element(data).content
  return template.content.cloneNode(true)
}

export const useRender = <
  T extends Record<string, any> | Record<string, any>[],
>(
  parent: HTMLElement | SVGElement,
  element: PlaitedElement<ElementType<T>>,
) => {
  let store: T
  const cache = new WeakMap<
    Record<string, any>,
    Node
  >()
  return Object.freeze<[
    Render<T>,
    Update<T>,
  ]>([
    (data: T) => {
      store = data
      const content = getContent(store, element as PlaitedElement)
      if (Array.isArray(store)) {
        const nodes = content.childNodes
        const length = store.length
        for (let i = 0; i < length; i++) {
          cache.set(store[i], nodes[i])
        }
      }
      parent.replaceChildren(content)
    },
    (callback: DataUpdate<T>) => {
      if (store) {
        store = callback(store)
        if (Array.isArray(store)) {
          const next: Node[] = []
          const length = store.length
          for (let i = 0; i < length; i++) {
            cache.has(store[i])
              ? next.push(cache.get(store[i]) as Node)
              : next.push(getContent(store[i], element as PlaitedElement))
          }
          parent.replaceChildren(...next)
        }
      } else {
        throw new Error(
          `called update before render on [${
            parent.getAttribute('data-target')
          }]`,
        )
      }
    },
  ])
}
