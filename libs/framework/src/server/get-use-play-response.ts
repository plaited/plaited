import { createZippedResponse, jsMimeTypes } from './create-zipped-response.js'

export const getUsePlayResponse = async (): Promise<Response> => {
  const { outputs } = await Bun.build({
    entrypoints: [Bun.resolveSync('./use-play', import.meta.dir)],
    minify: true,
    sourcemap: 'inline',
  })
  const str = await outputs[0].text()
  return await createZippedResponse(str, jsMimeTypes[0])
}
