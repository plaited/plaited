import type { Module } from '../../agent.ts'
import { THREE_AXIS_MODULE_SIGNAL_KEYS } from '../three-axis-module/three-axis-module.constants.ts'
import type { ThreeAxisState } from '../three-axis-module/three-axis-module.schemas.ts'
import { NODE_AUTH_MODULE_EVENTS, NODE_AUTH_MODULE_SIGNAL_KEYS } from './node-auth-module.constants.ts'
import {
  AuthenticateNodeAuthDetailSchema,
  type NodeAuthMode,
  type NodeAuthState,
  NodeAuthStateSchema,
  SetNodeAuthModeDetailSchema,
} from './node-auth-module.schemas.ts'
import type { CreateNodeAuthModuleOptions } from './node-auth-module.types.ts'

const deriveExposure = (mode: NodeAuthMode): NodeAuthState['exposureLevel'] => {
  switch (mode) {
    case 'dev':
      return 'private'
    case 'webauthn':
      return 'trusted'
    case 'platform_jwt':
    case 'enterprise_oidc':
      return 'public'
  }
}

const deriveAuthorityPolicy = ({
  mode,
  threeAxis,
}: {
  mode: NodeAuthMode
  threeAxis: ThreeAxisState | null
}): NodeAuthState['authorityPolicy'] => {
  if (mode === 'dev') return 'open'
  if (threeAxis?.decisions.some((decision) => decision.autonomyMode === 'owner_only')) return 'strict'
  if (mode === 'enterprise_oidc' || mode === 'platform_jwt') return 'balanced'
  return 'strict'
}

/**
 * Creates the bounded node auth policy module.
 *
 * @public
 */
export const createNodeAuthModule =
  ({
    stateSignalKey = NODE_AUTH_MODULE_SIGNAL_KEYS.state,
    threeAxisSignalKey = THREE_AXIS_MODULE_SIGNAL_KEYS.state,
    initialMode = 'dev',
  }: CreateNodeAuthModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: NodeAuthStateSchema,
        value: {
          mode: initialMode,
          exposureLevel: deriveExposure(initialMode),
          authorityPolicy: 'open',
          session: null,
        },
        readOnly: false,
      })

    const publish = (next: NodeAuthState) => {
      const parsed = NodeAuthStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as NodeAuthState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: NODE_AUTH_MODULE_EVENTS.node_auth_module_updated,
        detail: {
          mode: parsed.mode,
          exposureLevel: parsed.exposureLevel,
          authorityPolicy: parsed.authorityPolicy,
          authenticated: parsed.session !== null,
        },
      })
    }

    const rebuild = () => {
      const current = (stateSignal.get() ?? null) as NodeAuthState | null
      if (!current) return
      const threeAxis = (signals.get(threeAxisSignalKey)?.get() ?? null) as ThreeAxisState | null
      publish({
        ...current,
        exposureLevel: deriveExposure(current.mode),
        authorityPolicy: deriveAuthorityPolicy({ mode: current.mode, threeAxis }),
      })
    }

    signals.get(threeAxisSignalKey)?.listen(() => rebuild(), true)
    rebuild()

    return {
      handlers: {
        [NODE_AUTH_MODULE_EVENTS.node_auth_module_set_mode](detail) {
          const parsed = SetNodeAuthModeDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeAuthState | null
          if (!current) return
          const threeAxis = (signals.get(threeAxisSignalKey)?.get() ?? null) as ThreeAxisState | null
          publish({
            ...current,
            mode: parsed.data.mode,
            exposureLevel: deriveExposure(parsed.data.mode),
            authorityPolicy: deriveAuthorityPolicy({ mode: parsed.data.mode, threeAxis }),
          })
        },
        [NODE_AUTH_MODULE_EVENTS.node_auth_module_authenticate](detail) {
          const parsed = AuthenticateNodeAuthDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeAuthState | null
          if (!current) return
          publish({
            ...current,
            session: {
              principalId: parsed.data.principalId,
              trustClass: parsed.data.trustClass,
              capabilities: parsed.data.capabilities,
              authenticatedAt: Date.now(),
            },
          })
        },
        [NODE_AUTH_MODULE_EVENTS.node_auth_module_clear_session]() {
          const current = (stateSignal.get() ?? null) as NodeAuthState | null
          if (!current) return
          publish({
            ...current,
            session: null,
          })
        },
      },
    }
  }
