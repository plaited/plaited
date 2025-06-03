import { transformLocalFile } from './transform-local-file.js'

export const fetchLocalFile = (rootDirectory: string) => async (request: Request, _: Bun.Server) => {
  const { pathname } = new URL(request.url)
  try {
    const path =
      /\.js$/.test(pathname) ?
        Bun.resolveSync(`.${pathname}`, rootDirectory)
      : Bun.resolveSync(`.${pathname}.js`, rootDirectory)
    return transformLocalFile(path)
  } catch (error) {
    console.error(error)
    return new Response(`${error}`, { status: 500 })
  }
}
