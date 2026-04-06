export type CreateAcpFactoryOptions = {
  stateSignalKey?: string
  toolRegistrySignalKey?: string
  workflowStateSignalKey?: string
  transport?: 'stdio' | 'local_http'
  maxSessions?: number
}
