import { Template } from './create-template.js'

export const ssr = (...templates: Template[]) => {
  let content = ''
  const stylesheets = new Set<string>()
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const child = templates[i]
    if (typeof child === 'string') {
      content += child
      continue
    }
    content += child.content
    for (const sheet of child.stylesheets) {
      stylesheets.add(sheet)
    }
  }
  const style = stylesheets.size
    ? `<style>${[ ...stylesheets ].join('')}</style>`
    : ''

  const headIndex = content.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(content)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0

  const index = headIndex !== -1 ? headIndex : bodyIndex

  return content.slice(0, index) + style + content.slice(index)
}
