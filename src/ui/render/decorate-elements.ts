import type { DesignTokenReference, HostStylesObject } from '../css/css.types.ts'
import { joinStyles } from '../css/join-styles.ts'
import { createTemplate } from './template.ts'
import type { Attrs, CustomElementTag, FunctionTemplate, TemplateObject } from './template.types.ts'

/**
 * Creates a Shadow DOM custom element template from a server-rendered template object.
 *
 * @remarks
 * Wraps `shadowDom` in a declarative `<template shadowrootmode>` element and
 * returns a branded `DecoratorTemplate` function for use in SSR templates.
 * Host styles are injected before the shadow root and `:root` selectors are
 * rewritten to `:host` for Shadow DOM encapsulation.
 *
 * @param options.tag - Custom element tag name (must contain a hyphen)
 * @param options.shadowDom - Template object representing the shadow root content
 * @param options.mode - Shadow root mode, defaults to `'open'`
 * @param options.delegatesFocus - Whether focus is delegated into the shadow root, defaults to `true`
 * @param options.cloneable - Whether the shadow root is clonable, defaults to `true`
 * @param options.hostStyles - Optional host element styles or design token reference
 * @returns A branded `DecoratorTemplate` function for use in SSR templates
 *
 * @public
 */
export const decorateElements = ({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  cloneable = true,
  hostStyles,
}: {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus?: boolean
  cloneable?: boolean
  mode?: 'open' | 'closed'
  hostStyles?: HostStylesObject | DesignTokenReference
}): FunctionTemplate => {
  const { stylesheets } = joinStyles(hostStyles, { stylesheets: shadowDom.stylesheets ?? [] })
  if (stylesheets.length) {
    const styles = `<style>${[...new Set(stylesheets)].join('')}</style>`
      .replaceAll(/:root\{/g, ':host{')
      .replaceAll(/:root\(([^)]+)\)/g, ':host')
    shadowDom.html.unshift(styles)
  }
  const tpl = createTemplate('template', {
    shadowrootmode: mode,
    shadowrootdelegatesfocus: delegatesFocus,
    shadowrootclonable: cloneable,
    children: {
      ...shadowDom,
      stylesheets: [],
    },
  })
  return ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [tpl, ...(Array.isArray(children) ? children : [children])],
    })
}
