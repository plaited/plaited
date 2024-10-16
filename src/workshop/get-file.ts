import { transform } from '@swc/core'
import { zip } from './zip.js'

export const getFile = async (path: string) => {
  const file = Bun.file(path)
  try {
    const text = await file.text()
    const { code } = await transform(text, {
      filename: path,
      sourceMaps: 'inline',
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
            importSource: 'plaited',
          },
        },
      },
    })
    return zip(code)
  } catch (error) {
    console.error(error)
    return new Response('File not found', { status: 404 })
  }
}
