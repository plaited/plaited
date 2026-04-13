export type CreateIdentityTrustModuleOptions = {
  stateSignalKey?: string
  discoverySignalKey?: string
  permissionAuditSignalKey?: string
  localIdentityId?: string
  trustServiceProfile?: 'local_store' | 'self_hosted_service' | 'provider_managed'
  maxPeers?: number
}
