import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from './build.js'
import { globStories, globWorkers, globTemplates } from './glob.js'
import { mapStories, mapEntries } from './map.js'
import { scanStoryExports, StoriesMap } from './scan.js'
import { PLAITED_PATHNAME } from '../client/client.constants.js'
import type { Trigger } from '../behavioral/b-program.js'
import { isBPEvent } from '../behavioral/b-thread.js'
import { ServerWebSocket } from 'bun'
import { isTypeOf } from '../utils/is-type-of.js'
import type { useStore } from "../client/use-store.js";

const getRoutesAndPath = async (cwd: string) => {
  const storyFiles = await globStories(cwd)
  const templateFiles = await globTemplates(cwd)
  const workerFiles = await globWorkers(cwd)
  console.log({ templateFiles, workerFiles })
  const stories: StoriesMap = new Map()
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-'))
  await Promise.all(storyFiles.map(async (filePath) => await scanStoryExports({ filePath, stories, cwd, tmp })))
  const entries = [...stories.values()].map(({ entryPath }) => entryPath)
  const responseMap: Map<string, Response> = new Map()
  await mapStories({ cwd, stories, tmp, responseMap })
  const getResponses = () => {
    const toRet: Record<string, Response> = {}
    for (const [path, response] of responseMap) {
      toRet[path] = response.clone()
    }
    return toRet
  } 
  const pathnames = [...responseMap.keys()]
  const { outputs, success, logs } = await build({ root: tmp, entries, cwd })
  if (!success) {
    console.error(logs)
    return { pathnames, getResponses }
  }
  mapEntries(outputs, responseMap)
  await fs.rmdir(tmp, { recursive: true })
  

  return { pathnames, getResponses }
}

export const useServer = async ({
  cwd,
  socket,
  trigger,
}:{
  cwd: string,
  socket: ReturnType<typeof useStore<ServerWebSocket<unknown>>>,
  trigger: Trigger
}) => {
  const { getResponses, pathnames } = await getRoutesAndPath(cwd)
  const server = Bun.serve({
    port: 6006,
    static: getResponses(),
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === PLAITED_PATHNAME) {
        const success = server.upgrade(req);
        return success
        ? undefined
        : new Response("WebSocket upgrade error", { status: 400 });
      }
      return new Response("Plaited Workshop");
    },
    websocket: {
      open(ws) {
        socket(ws)
      },
      message(_, message) {
        if(isTypeOf<string>(message, 'string')){
          try {
            const data = JSON.parse(message);
            isBPEvent(data) && trigger(data)
          } catch (error) {
            console.error('Error parsing incoming message:', error);
          }
        }
      },
    }
  })
  return {server, pathnames, getResponses}
}



