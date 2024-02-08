import { sync, loop, thread, BPEvent } from 'plaited'

export const types = {
  CREATE_MODULE_TEMPLATE: 'create module template',
  DOWNLOAD_MODULE_TEMPLATE: 'download module template',
  ADD_CONTENT_TO_MODULE: 'add content to module',
  CONNECT_MODULE_TO_NETWORK: 'connect module to network',
  DISCONNECT_MODULE_FROM_NETWORK: 'disconnect module from network',
  CREATE_MODULE_NETWORK: 'create module network',
  REQUEST_TO_CONNECT_MODULE_TO_NETWORK: 'request to connect module to network',
  CONNECT_TO_NETWORK: 'connect to network',
  SEARCH_FOR_MODULES_TO_CONNECT: 'search for modules to connect',
  SEARCH_MODULES: 'search modules',
  CREATE_MODULE_COLLECTION: 'create module collection',
  ADD_MODULE_TO_COLLECTION: 'add module to collection',
  CONNECT_COLLECTION_TO_NETWORK: 'connect collection to network',
  DISCONNECT_COLLECTION_FROM_NETWORK: 'disconnect collection from network',
  REQUEST_TO_CONNECT_COLLECTION_TO_NETWORK: 'request to connect collection to network',
} as const

export const events = {
  createModuleTemplate(description: string): BPEvent<string> {
    return { type: types.CREATE_MODULE_TEMPLATE, detail: description }
  },
  downloadModuleTemplate(id: string): BPEvent<string> {
    return { type: types.DOWNLOAD_MODULE_TEMPLATE, detail: id }
  },
  addContentToModule(): BPEvent {
    return { type: types.ADD_CONTENT_TO_MODULE }
  },
  connectModuleToNetwork(id: string): BPEvent<string> {
    return { type: types.CONNECT_MODULE_TO_NETWORK, detail: id }
  },
  disconnectModuleFromNetwork(id: string): BPEvent<string> {
    return { type: types.DISCONNECT_MODULE_FROM_NETWORK, detail: id }
  },
  createModuleNetwork(description: string): BPEvent<string> {
    return { type: types.CREATE_MODULE_NETWORK, detail: description }
  },
  requestToConnectModuleToNetwork(id: string): BPEvent<string> {
    return { type: types.REQUEST_TO_CONNECT_MODULE_TO_NETWORK, detail: id }
  },
  connectToNetwork(id: string): BPEvent<string> {
    return { type: types.CONNECT_TO_NETWORK, detail: id }
  },
  searchForModulesToConnect(description: string): BPEvent<string> {
    return { type: types.SEARCH_FOR_MODULES_TO_CONNECT, detail: description }
  },
  searchModules(query: string): BPEvent<string> {
    return { type: types.SEARCH_MODULES, detail: query }
  },
  createModuleCollection(description: string): BPEvent<string> {
    return { type: types.CREATE_MODULE_COLLECTION, detail: description }
  },
  addModuleToCollection(moduleId: string, collectionId: string): BPEvent<{ moduleId: string; collectionId: string }> {
    return { type: types.ADD_MODULE_TO_COLLECTION, detail: { moduleId, collectionId } }
  },
  connectCollectionToNetwork(
    networkId: string,
    collectionId: string,
  ): BPEvent<{ networkId: string; collectionId: string }> {
    return { type: types.CONNECT_COLLECTION_TO_NETWORK, detail: { networkId, collectionId } }
  },
  disconnectCollectionFromNetwork(
    networkId: string,
    collectionId: string,
  ): BPEvent<{ networkId: string; collectionId: string }> {
    return { type: types.DISCONNECT_COLLECTION_FROM_NETWORK, detail: { networkId, collectionId } }
  },
  requestToConnectCollectionToNetwork(
    networkId: string,
    collectionId: string,
  ): BPEvent<{ networkId: string; collectionId: string }> {
    return { type: types.REQUEST_TO_CONNECT_COLLECTION_TO_NETWORK, detail: { networkId, collectionId } }
  },
} as const
