import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createThreeAxisFactory } from '../../three-axis-factory/three-axis-factory.ts'
import { createToolRegistryFactory } from '../../tool-registry-factory/tool-registry-factory.ts'
import { PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS } from '../permission-audit-factory.constants.ts'
import type { PermissionAuditLedgerSchema } from '../permission-audit-factory.schemas.ts'
import { createPermissionAuditFactory } from '../permission-audit-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createPermissionAuditFactory', () => {
  test('retains an authority ledger from three-axis decisions', async () => {
    let ledgerSignal: Signal<typeof PermissionAuditLedgerSchema> | undefined

    await createAgent({
      id: 'agent:permission-audit',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createToolRegistryFactory(),
        createThreeAxisFactory(),
        createPermissionAuditFactory(),
        ({ signals }) => {
          ledgerSignal = signals.get(PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS.ledger) as Signal<
            typeof PermissionAuditLedgerSchema
          >
          return {}
        },
      ],
    })

    await Bun.sleep(50)

    expect((ledgerSignal?.get() ?? []).length).toBeGreaterThan(0)
    expect(ledgerSignal?.get()?.some((entry) => entry.capabilityId === 'builtin:bash')).toBe(true)
  })
})
