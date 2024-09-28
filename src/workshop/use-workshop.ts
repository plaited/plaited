import { build } from './build.js'
import { globStories, globWorkers } from './glob.js'
import { mapStoryResponses, mapEntryResponses } from './map.js'
import { USE_PLAY_FILE_PATH } from './workshop.constants.js'


export const getRoutesAndPath = async (cwd: string) => {
  const workerEntries = await globWorkers(cwd)
  const storyEntries = await globStories(cwd)
  const responseMap: Map<string, Response> = new Map()
  const getResponses = () => {
    const toRet: Record<string, Response> = {}
    for (const [path, response] of responseMap) {
      toRet[path] = response.clone()
    }
    return toRet
  }
  const stories = await mapStoryResponses({ storyEntries, responseMap, cwd })
  const entries = [
    ...storyEntries,
    ...workerEntries,
    USE_PLAY_FILE_PATH,
  ]
  const {outputs, success, logs} = await build(cwd, entries)
  if (!success) {
    return console.error(logs)
  }
  await mapEntryResponses({outputs, responseMap})

  return { stories, getResponses }
}
const obj = await getRoutesAndPath(`${process.cwd()}/src`)
if(obj){
  console.log(obj.stories)
}
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



