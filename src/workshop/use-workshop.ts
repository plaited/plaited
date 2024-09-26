import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from './build.js'
import { globStories, globWorkers } from './glob.js'
import { mapStories } from './map.js'
import { scanStories } from './scan.js'
import { WORKER_FILTER_REGEX } from './workshop.constants.js'
const getRoutesAndPath = async (cwd: string) => {
  const workerFiles = await globWorkers(cwd)
  const workerEntries = workerFiles.flatMap(
    filePath => WORKER_FILTER_REGEX.test(filePath)
      ? Bun.resolveSync(`./${filePath}`, cwd)
      : []
    )
  const storyFiles = await globStories(cwd)
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-'))
  const storyMap = await Promise.all(
    storyFiles.map(async (filePath) => await scanStories({cwd, filePath, tmp}))
  ).then((arr) => arr.flat())
  const responseMap: Map<string, Response> = new Map()
  await mapStories({ storyMap, responseMap })
  const getResponses = () => {
    const toRet: Record<string, Response> = {}
    for (const [path, response] of responseMap) {
      toRet[path] = response.clone()
    }
    return toRet
  } 
  const storyEntries = storyMap.map(arr => `${tmp}/${arr[0]}`)
  const entries =[
    ...workerEntries,
    ...storyEntries  
  ]
  const result= await build(tmp, entries)
  console.log(result)
  // if (!success) {
  //   console.error(logs)
  //   return { pathnames, getResponses }
  // }
  // mapEntries(outputs, responseMap)
  
  await fs.rmdir(tmp, { recursive: true })
  // return { pathnames, getResponses }
}
await getRoutesAndPath(`${process.cwd()}/src`)
// export const useServer = async ({
//   cwd,
//   socket,
//   trigger,
// }:{
//   cwd: string,
//   socket: ReturnType<typeof useStore<ServerWebSocket<unknown>>>,
//   trigger: Trigger
// }) => {
//   const { getResponses, pathnames } = await getRoutesAndPath(cwd)
//   const server = Bun.serve({
//     port: 6006,
//     static: getResponses(),
//     fetch(req, server) {
//       const url = new URL(req.url);
//       if (url.pathname === PLAITED_PATHNAME) {
//         const success = server.upgrade(req);
//         return success
//         ? undefined
//         : new Response("WebSocket upgrade error", { status: 400 });
//       }
//       return new Response("Plaited Workshop");
//     },
//     websocket: {
//       open(ws) {
//         socket(ws)
//       },
//       message(_, message) {
//         if(isTypeOf<string>(message, 'string')){
//           try {
//             const data = JSON.parse(message);
//             isBPEvent(data) && trigger(data)
//           } catch (error) {
//             console.error('Error parsing incoming message:', error);
//           }
//         }
//       },
//     }
//   })
//   return {server, pathnames, getResponses}
// }



