import { Emit } from '../types.js'
import { PlaitedHDA } from './constants.js'

export const hasPlaitedContext = (
  win: Window,
): win is Window & {
  [PlaitedHDA]: true
} => PlaitedHDA in win && win[PlaitedHDA] === true

export const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'

/** @description emit a custom event cancelable and composed are true by default */
export const emit =
  (host: HTMLElement) =>
  ({ type, detail, bubbles = false, cancelable = true, composed = true }: Parameters<Emit>[0]) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    host.dispatchEvent(event)
  }
let parser: {
  parseFromString(
    string: string,
    type: DOMParserSupportedType,
    options: {
      includeShadowRoots: boolean
    },
  ): Document
}

export const createDoc = (page: string) => {
  if (typeof window !== 'undefined' && window.DOMParser) {
    parser = new DOMParser()
  }
  return parser.parseFromString(page, 'text/html', { includeShadowRoots: true })
}

export const createTemplate = (content: string) => {
  if (typeof window !== 'undefined' && window.DOMParser) {
    parser = new DOMParser()
  }
  const fragment = parser.parseFromString(`<template>${content}</template>`, 'text/html', {
    includeShadowRoots: true,
  })
  return fragment.head.firstChild as HTMLTemplateElement
}
