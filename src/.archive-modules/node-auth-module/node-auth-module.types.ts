export type CreateNodeAuthModuleOptions = {
  stateSignalKey?: string
  threeAxisSignalKey?: string
  initialMode?: 'webauthn' | 'platform_jwt' | 'enterprise_oidc' | 'dev'
}
