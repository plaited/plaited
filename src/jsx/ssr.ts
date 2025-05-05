import { escape } from '../utils/escape.js'
import { isTypeOf } from '../utils/is-type-of.js'
import type { TemplateObject } from './jsx.types.js'
import { VALID_PRIMITIVE_CHILDREN, TEMPLATE_OBJECT_IDENTIFIER } from './jsx.constants.js'

/**
 * @description Generates an HTML string from Plaited template objects for server-side rendering (SSR).
 * It recursively processes templates, collects unique stylesheets, and injects them into the resulting HTML string.
 * Primitive values are safely escaped.
 *
 * @param {...TemplateObject} templates - One or more Plaited template objects to render.
 * @returns {string} An HTML string representation of the provided templates, with collected styles injected.
 *
 * @example
 * ```typescript
 * import { ssr, createTemplate } from '@plaited/jsx'
 * import { MyComponent } from './my-component.js' // Assuming MyComponent is a PlaitedTemplate or FunctionTemplate
 *
 * const pageTemplate = createTemplate('html', {
 *    lang: 'en'
 *    children: [
 *   createTemplate('head', {},
 *     createTemplate('meta', { charset: 'utf-8' }),
 *     createTemplate('title', {}, 'My SSR Page')
 *   ),
 *   createTemplate('body', {},
 *     createTemplate('header', {},
 *       createTemplate('h1', {}, 'Welcome')
 *     ),
 *     MyComponent({ message: 'Hello from SSR!' })
 *   )
 * ]
 *  },
 * );
 *
 * const htmlString = ssr(pageTemplate);
 *
 * console.log(htmlString);
 * // Output will be the HTML string with styles from MyComponent (and others)
 * // injected right before the closing </head> tag (or after <body> if no <head>).
 * ```
 *
 * @remarks
 * - **Style Injection:** Stylesheets (`.stylesheets`) from all processed `TemplateObject` instances are collected.
 *   Duplicate stylesheets are automatically ignored. The collected styles are combined into a single `<style>`
 *   tag and injected into the HTML output.
 * - **Injection Point:** The `<style>` tag is injected preferably right before the closing `</head>` tag.
 *   If `</head>` is not found, it attempts to inject right after the opening `<body ...>` tag.
 *   If neither is found, styles are prepended to the beginning of the generated string.
 * - **Child Handling:** Only valid primitive types (string, number, boolean, bigint) and `TemplateObject`
 *   instances are processed as children. Other types are ignored. Primitive children are escaped for safety.
 * - **Template Structure:** It expects standard HTML structure (`<html>`, `<head>`, `<body>`) for optimal
 *   style injection, but it will attempt injection even if the structure is non-standard.
 */
export const ssr = (...templates: TemplateObject[]) => {
  const arr = []
  const stylesheets = new Set<string>()
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const child = templates[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      arr.push(...child.html)
      for (const sheet of child.stylesheets) {
        stylesheets.add(sheet)
      }
      continue
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(typeof child)) continue
    const safeChild = escape(`${child}`)
    arr.push(safeChild)
  }
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
  const str = arr.join('')
  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
  const index = headIndex !== -1 ? headIndex : bodyIndex
  return str.slice(0, index) + style + str.slice(index)
}
