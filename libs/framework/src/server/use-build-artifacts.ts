import { BuildArtifact } from 'bun'
import { isJsMimeType, createZippedResponse } from './create-zipped-response.js'


export const useBuildArtifacts = async (outputs: BuildArtifact[]) => {
  const handlers = new Map<string, () => Response>()
  await Promise.all(
    outputs.map(async (output) => {
      const { type } = output
      if (isJsMimeType(type)) {
        const str = await output.text()
        const { path } = output
        const formattedPath = path.startsWith('./') ? path.slice(1) : `/${path}`
        handlers.set(formattedPath, () => createZippedResponse(str, type))
      }
    }),
  )
  return handlers
}
