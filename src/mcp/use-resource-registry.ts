import {
  McpServer,
  type RegisteredResource,
  type RegisteredResourceTemplate,
  type ReadResourceCallback,
  type ReadResourceTemplateCallback,
  type ResourceTemplate,
  type ResourceMetadata,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { type PlaitedTrigger, type SignalWithoutInitialValue, useSignal } from '../behavioral.js'

type ResourceSignal<T> = SignalWithoutInitialValue<{
  resolve: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['reject']
  args?: T
}>

const registerResource = ({
  server,
  name,
  uriOrTemplate,
  metaData,
  trigger,
}: {
  server: McpServer
  name: string
  uriOrTemplate: string | ResourceTemplate
  metaData: ResourceMetadata
  trigger: PlaitedTrigger
}): RegisteredResourceTemplate | RegisteredResource => {
  const signal: ResourceSignal<
    typeof uriOrTemplate extends ResourceTemplate ? Parameters<ReadResourceTemplateCallback>
    : Parameters<ReadResourceCallback>
  > = useSignal()
  const callback: typeof uriOrTemplate extends ResourceTemplate ? ReadResourceTemplateCallback
  : ReadResourceCallback = async (...args) => {
    const { promise, resolve, reject } = Promise.withResolvers<ReadResourceResult>()
    signal.set({
      resolve,
      reject,
      args,
    })
    return promise
  }
  const resource = server.registerResource(name, uriOrTemplate, metaData, callback)
  signal.listen(name, trigger)
  return resource
}

export type ResourceRegistry = {
  [k: string]: {
    metaData: ResourceMetadata
    uriOrTemplate: string | ResourceTemplate
  }
}

export const useResourceRegistry = <T extends ResourceRegistry>({
  server,
  registry,
  trigger,
}: {
  server: McpServer
  registry: T
  trigger: PlaitedTrigger
}) =>
  Object.entries(registry).reduce(
    (acc, [name, { metaData, uriOrTemplate }]) => {
      return { ...acc, [name]: registerResource({ server, name, metaData, uriOrTemplate, trigger }) }
    },
    {} as {
      [K in keyof T]: RegisteredResourceTemplate | RegisteredResource
    },
  )
