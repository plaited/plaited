import * as path from 'node:path'
import * as fs from 'node:fs'

import type { FunctionTemplate, PlaitedTemplate } from 'plaited'

if (typeof global.HTMLElement === 'undefined') {
  // @ts-ignore node env
  global.HTMLElement = class HTMLElement {}
}

// COULD DO DEFAULT EXPORT CHECK HERE

const findLayout = ({dir, ext, root}: {dir: string, ext: '.tsx' | '.jsx', root: string}): string | null => {
  if (!dir.startsWith(root)) {
    console.error(`Error: ${dir} is not a child of ${root}`);
    return null;
  }
  const layoutFilePath = path.join(dir, `layout${ext}`);
  if (fs.existsSync(layoutFilePath)) {
    return layoutFilePath;
  }
  if (dir === root) {
    return null; // We've reached the root directory
  }
  const parentDir = path.dirname(dir);
  return findLayout({dir: parentDir, ext, root});
}

export const initRender = (root: string, ext: '.tsx' | '.jsx') => {
  return async (func: FunctionTemplate | PlaitedTemplate, url: string) => {
    const filePath = Bun.fileURLToPath(new URL(url))
    const layoutPath = findLayout({ dir: path.dirname(filePath), ext, root });
    if (!layoutPath) return
    const mod = await import(layoutPath)
    const layout = mod.default as FunctionTemplate // NEED TO ADD TYPE GUARD HERE OR DO A CHECK IN THE FIND LAYOUT FUNCTION
    return (args: Parameters<typeof func>[0]) => {
      const { server, stylesheets} = layout({ children: func(args)})
      const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
      // WILL PROBABLY NEED TO MODIFY THIS TO HANDLE LAYOUT DEFINITION
      const script = `<script type="module" async>try{const m = await import('${filePath}');m?.default?.define()}catch(e){console.error(e)}</script>`
      const str = server.join('')
      const headIndex = str.indexOf('</head>')
      const bodyRegex = /<body\b[^>]*>/i
      const bodyMatch = bodyRegex.exec(str)
      const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
      const index = headIndex !== -1 ? headIndex : bodyIndex
      return str.slice(0, index) + script + style + str.slice(index)
    }
  }
}