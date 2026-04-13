export type CreateAcpModuleOptions = {
  stateSignalKey?: string
  toolRegistrySignalKey?: string
  workflowStateSignalKey?: string
  transport?: 'stdio' | 'local_http'
  maxSessions?: number
}
