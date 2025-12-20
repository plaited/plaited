import { zip } from './workshop.utils.ts'

export const getEntryRoutes = async (root: string, entrypoints: string[]) => {
  const responses: {
    [key: string]: Response
  } = {}
  const { outputs } = await Bun.build({
    entrypoints,
    splitting: true,
    minify: false, // Keep disabled for faster test builds
    root,
    sourcemap: 'inline',
  })
  await Promise.all(
    outputs.map(async (artifact) => {
      const path = artifact.path
      const content = await artifact.text()

      // Normalize path: remove leading ./ and ensure starts with /
      let formattedPath = path.replace(/^\.\//, '/')
      if (!formattedPath.startsWith('/')) {
        formattedPath = `/${formattedPath}`
      }

      Object.assign(responses, {
        [formattedPath]: zip({
          content,
          contentType: artifact.type,
        }),
      })
    }),
  )
  return responses
}
