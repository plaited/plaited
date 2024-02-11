import { sync, loop, thread, BPEvent } from 'plaited'
import { keyMirror } from '@plaited/utils'

const crudTypes = <T extends string>(context: T) =>
  [`CREATE_${context}`, `READ_${context}`, `UPDATE_${context}`, `DELETE_${context}`] as const

export const types = {
  // MODULE_SCHEMA
  ...keyMirror(...crudTypes('MODULE_SCHEMA'), 'DOWNLOAD_MODULE_SCHEMA', 'SEARCH_FOR_MODULE_SCHEMA'),
  ...keyMirror(...crudTypes('MODULE_SCHEMA_SCALE')),
  ...keyMirror(...crudTypes('MODULE_SCHEMA_BOUNDARIES')),
  ...keyMirror(...crudTypes('MODULE_SCHEMA_DESCRIPTION')),
  ...keyMirror(...crudTypes('MODULE_SCHEMA_ACTIONS')),
  ...keyMirror(...crudTypes('MODULE_SCHEMA_CHANNELS')),
  ...keyMirror(...crudTypes('MODULE_SCHEMA_MICROINTERACTIONS')),
  // MODULE

  // ADD_CONTENT_TO_MODULE: 'add content to module',
  // CONNECT_MODULE_TO_NETWORK: 'connect module to network',
  // DISCONNECT_MODULE_FROM_NETWORK: 'disconnect module from network',
  // CREATE_MODULE_NETWORK: 'create module network',
  // REQUEST_TO_CONNECT_MODULE_TO_NETWORK: 'request to connect module to network',
  // CONNECT_TO_NETWORK: 'connect to network',
  // SEARCH_FOR_MODULES_TO_CONNECT: 'search for modules to connect',
  // SEARCH_MODULES: 'search modules',
  // CREATE_MODULE_COLLECTION: 'create module collection',
  // ADD_MODULE_TO_COLLECTION: 'add module to collection',
  // CONNECT_COLLECTION_TO_NETWORK: 'connect collection to network',
  // DISCONNECT_COLLECTION_FROM_NETWORK: 'disconnect collection from network',
  // REQUEST_TO_CONNECT_COLLECTION_TO_NETWORK: 'request to connect collection to network',
  // GET_MODULE_SCHEMA: 'get module schema',
} as const

// export const events = {
//   createModuleSchema(description: string): BPEvent<string> {
//     return { type: types.CREATE_MODULE_SCHEMA, detail: description }
//   },
//   downloadModuleSchema(id: string): BPEvent<string> {
//     return { type: types.DOWNLOAD_MODULE_SCHEMA, detail: id }
//   },
//   addContentToModule(): BPEvent {
//     return { type: types.ADD_CONTENT_TO_MODULE }
//   },
//   connectModuleToNetwork(id: string): BPEvent<string> {
//     return { type: types.CONNECT_MODULE_TO_NETWORK, detail: id }
//   },
//   disconnectModuleFromNetwork(id: string): BPEvent<string> {
//     return { type: types.DISCONNECT_MODULE_FROM_NETWORK, detail: id }
//   },
//   createModuleNetwork(description: string): BPEvent<string> {
//     return { type: types.CREATE_MODULE_NETWORK, detail: description }
//   },
//   requestToConnectModuleToNetwork(id: string): BPEvent<string> {
//     return { type: types.REQUEST_TO_CONNECT_MODULE_TO_NETWORK, detail: id }
//   },
//   connectToNetwork(id: string): BPEvent<string> {
//     return { type: types.CONNECT_TO_NETWORK, detail: id }
//   },
//   searchForModulesToConnect(description: string): BPEvent<string> {
//     return { type: types.SEARCH_FOR_MODULES_TO_CONNECT, detail: description }
//   },
//   searchModules(query: string): BPEvent<string> {
//     return { type: types.SEARCH_MODULES, detail: query }
//   },
//   createModuleCollection(description: string): BPEvent<string> {
//     return { type: types.CREATE_MODULE_COLLECTION, detail: description }
//   },
//   addModuleToCollection(moduleId: string, collectionId: string): BPEvent<{ moduleId: string; collectionId: string }> {
//     return { type: types.ADD_MODULE_TO_COLLECTION, detail: { moduleId, collectionId } }
//   },
//   connectCollectionToNetwork(
//     networkId: string,
//     collectionId: string,
//   ): BPEvent<{ networkId: string; collectionId: string }> {
//     return { type: types.CONNECT_COLLECTION_TO_NETWORK, detail: { networkId, collectionId } }
//   },
//   disconnectCollectionFromNetwork(
//     networkId: string,
//     collectionId: string,
//   ): BPEvent<{ networkId: string; collectionId: string }> {
//     return { type: types.DISCONNECT_COLLECTION_FROM_NETWORK, detail: { networkId, collectionId } }
//   },
//   requestToConnectCollectionToNetwork(
//     networkId: string,
//     collectionId: string,
//   ): BPEvent<{ networkId: string; collectionId: string }> {
//     return { type: types.REQUEST_TO_CONNECT_COLLECTION_TO_NETWORK, detail: { networkId, collectionId } }
//   },
//   setModuleSchemaDescription(description: string): BPEvent<string> {
//     return { type: types.SET_MODULE_SCHEMA_DESCRIPTION, detail: description }
//   },
//   getModuleSchema(id: string): BPEvent<string> {
//     return { type: types.GET_MODULE_SCHEMA, detail: id }
//   },
//   setModuleSchemaChannels(channels: string[]): BPEvent<string[]> {
//     return { type: types.SET_MODULE_SCHEMA_CHANNELS, detail: channels }
//   },
//   setModuleSchemaMicrointeractions(microinteractions: string[]): BPEvent<string[]> {
//     return { type: types.SET_MODULE_SCHEMA_MICROINTERACTIONS, detail: microinteractions }
//   },
//   setModuleSchemaBoundaries(boundaries: string[]): BPEvent<string[]> {
//     return { type: types.SET_MODULE_SCHEMA_BOUNDARIES, detail: boundaries }
//   },
//   setModuleSchemaActions(actions: string[]): BPEvent<string[]> {
//     return { type: types.SET_MODULE_SCHEMA_ACTIONS, detail: actions }
//   },
//   setModuleSchemaScale(scale: string): BPEvent<string> {
//     return { type: types.SET_MODULE_SCHEMA_SCALE, detail: scale }
//   },
//   searchForModuleSchema(query: string): BPEvent<string> {
//     return { type: types.SEARCH_FOR_MODULE_SCHEMA, detail: query }
//   },
// } as const
