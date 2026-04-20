import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { behavioral, type SnapshotMessage, useInstaller } from '../../behavioral.ts'
import { moduleProgramAdmissionActorExtension } from '../../modules.ts'
import {
  evaluateModuleProgramAdmission,
  MODULE_PROGRAM_ADMISSION_ACTOR_EVENTS,
  ModuleProgramAdmissionDecisionSchema,
  ModuleProgramDescriptorSchema,
  toModuleProgramAdmissionActorEventType,
} from '../module-program-admission.ts'
import { ProjectionDescriptorSchema } from '../projection-boundary-actor.ts'

type ObservedEvent = { type: string; detail?: unknown }
type Harness = {
  events: ObservedEvent[]
  snapshots: SnapshotMessage[]
  trigger: (event: { type: string; detail?: unknown }) => void
}

const descriptorEvaluateEventType = toModuleProgramAdmissionActorEventType(
  MODULE_PROGRAM_ADMISSION_ACTOR_EVENTS.descriptor_evaluate,
)
const decisionEventType = toModuleProgramAdmissionActorEventType(MODULE_PROGRAM_ADMISSION_ACTOR_EVENTS.decision)

const farmStandSupplierProjection = ProjectionDescriptorSchema.parse({
  projectionId: 'farm-stand-supplier-v1',
  sourceModuleId: 'farm-stand',
  audience: {
    kind: 'supplier-view',
    id: 'supplier-network-1',
  },
  shape: {
    fields: ['supplierSku', 'inventoryStatus', 'reorderThreshold'],
    facts: ['stock-level'],
    resources: ['purchase-orders'],
  },
  provenance: {
    sourceId: 'farm-stand-owner-state',
    sourceModuleId: 'farm-stand',
    lineage: ['inventory-ledger', 'owner-console'],
  },
})

const farmStandMarketOrganizerProjection = ProjectionDescriptorSchema.parse({
  projectionId: 'farm-stand-market-organizer-v1',
  sourceModuleId: 'farm-stand',
  audience: {
    kind: 'market-organizer-view',
    id: 'organizer-1',
  },
  shape: {
    fields: ['boothId', 'inspectionStatus', 'deliveryWindow'],
    facts: ['compliance-attestation'],
    resources: ['logistics-manifest'],
  },
  provenance: {
    sourceId: 'farm-stand-owner-state',
    sourceModuleId: 'farm-stand',
    lineage: ['booth-compliance', 'market-logistics'],
  },
})

const farmStandShopperProjection = ProjectionDescriptorSchema.parse({
  projectionId: 'farm-stand-shopper-v1',
  sourceModuleId: 'farm-stand',
  audience: {
    kind: 'shopper-view',
  },
  shape: {
    fields: ['catalogTitle', 'availabilityBand'],
    facts: ['public-stock-band'],
    resources: ['catalog'],
  },
  provenance: {
    sourceId: 'farm-stand-owner-state',
    sourceModuleId: 'farm-stand',
    lineage: ['catalog-export'],
  },
})

const baseFarmStandDescriptor = ModuleProgramDescriptorSchema.parse({
  programId: 'farm-stand',
  name: 'Farm Stand',
  version: '1.0.0',
  source: {
    kind: 'local-file',
    path: 'src/modules/farm-stand.ts',
    issue: 328,
    commit: '0a4f1123',
  },
  provenance: {
    createdBy: 'node-owner',
    createdFromIssue: 328,
    createdFromPrompt: 'Create a governed farm stand module program descriptor.',
    reviewedBy: ['runtime-reviewer'],
  },
  mssTags: {
    content: ['produce-catalog'],
    structure: ['projection-descriptors'],
    mechanics: ['admission-decision'],
    boundary: ['projection-governed-sharing'],
    scale: ['single-node-starter'],
  },
  moduleSharingPolicy: 'all',
  declaredProjections: [farmStandSupplierProjection, farmStandMarketOrganizerProjection, farmStandShopperProjection],
  declaredAccessRequests: [
    {
      kind: 'module-projection-read',
      targetModuleId: 'inventory-hub',
      projectionId: 'inventory-hub-supplier-v1',
      reason: 'Needs supplier-facing inventory state.',
    },
  ],
  validation: {
    tests: ['src/modules/tests/module-program-admission.spec.ts'],
    commands: ['bun test src/modules/tests/module-program-admission.spec.ts'],
    notes: ['Future module proposal generators should emit this validation metadata.'],
  },
  notes: ['Farm Stand is an example source module program fixture only.'],
})

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const createDescriptor = () => clone(baseFarmStandDescriptor)

const createHarness = (): Harness => {
  const events: ObservedEvent[] = []
  const snapshots: SnapshotMessage[] = []
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const install = useInstaller({
    trigger,
    useSnapshot,
    reportSnapshot,
    addBThread,
    ttlMs: 1_000,
  })

  useFeedback(install(moduleProgramAdmissionActorExtension))
  useFeedback({
    [decisionEventType]: (detail: unknown) => {
      events.push({ type: decisionEventType, detail })
    },
  })
  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })

  return { events, snapshots, trigger }
}

const waitForDecisionEvent = async ({
  harness,
  after = 0,
  timeoutMs = 3_000,
}: {
  harness: Harness
  after?: number
  timeoutMs?: number
}) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const match = harness.events.slice(after).find((event) => event.type === decisionEventType)
    if (match) {
      return ModuleProgramAdmissionDecisionSchema.parse(match.detail)
    }
    await Bun.sleep(10)
  }

  throw new Error('Timed out waiting for module program admission decision event')
}

describe('module program admission actor', () => {
  test('keeps a flat actor file and does not create a nested module-program-admission folder', async () => {
    expect(await Bun.file('src/modules/module-program-admission.ts').exists()).toBe(true)
    expect(existsSync('src/modules/module-program-admission')).toBe(false)
  })

  test('emits an admission decision through the flat actor extension surface', async () => {
    const harness = createHarness()
    harness.trigger({
      type: descriptorEvaluateEventType,
      detail: createDescriptor(),
    })

    const decision = await waitForDecisionEvent({ harness })
    expect(decision.decision).toBe('admitted')
    expect(decision.reason).toBe('module-program-descriptor-valid')
  })

  test('admits a valid module program descriptor', () => {
    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })

    expect(decision.decision).toBe('admitted')
    expect(decision.reason).toBe('module-program-descriptor-valid')
    expect(decision.requirements).toEqual([])
    expect(decision.diagnostics).toEqual([])
  })

  test('rejects descriptor missing a required MSS tag category', () => {
    const descriptor = createDescriptor() as Record<string, unknown>
    const mssTags = { ...(descriptor.mssTags as Record<string, unknown>) }
    delete mssTags.boundary
    descriptor.mssTags = mssTags

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('missing-required-mss-tags')
    expect(decision.requirements[0]).toEqual(
      expect.objectContaining({
        kind: 'mss-tags',
        fields: expect.arrayContaining(['boundary']),
      }),
    )
  })

  test('rejects descriptor with an empty required MSS tag category', () => {
    const descriptor = createDescriptor()
    descriptor.mssTags.scale = []

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('missing-required-mss-tags')
    expect(decision.requirements[0]).toEqual(
      expect.objectContaining({
        kind: 'mss-tags',
        fields: expect.arrayContaining(['scale']),
      }),
    )
  })

  test('rejects descriptor missing moduleSharingPolicy', () => {
    const descriptor = createDescriptor() as Record<string, unknown>
    delete descriptor.moduleSharingPolicy

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('invalid-module-sharing-policy')
  })

  test('rejects descriptor with invalid moduleSharingPolicy', () => {
    const descriptor = createDescriptor() as Record<string, unknown>
    descriptor.moduleSharingPolicy = 'invalid-policy'

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('invalid-module-sharing-policy')
  })

  test('preserves all sharing policy in admission output', () => {
    const descriptor = createDescriptor()
    descriptor.moduleSharingPolicy = 'all'

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.moduleSharingPolicy).toBe('all')
  })

  test('preserves none sharing policy in admission output', () => {
    const descriptor = createDescriptor()
    descriptor.moduleSharingPolicy = 'none'

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.moduleSharingPolicy).toBe('none')
  })

  test('preserves ask sharing policy in admission output', () => {
    const descriptor = createDescriptor()
    descriptor.moduleSharingPolicy = 'ask'

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.moduleSharingPolicy).toBe('ask')
  })

  test('declared supplier, market-organizer, and shopper projections are structurally valid and distinct', () => {
    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.declaredProjections).toHaveLength(3)

    const projectionIds = (decision.descriptor?.declaredProjections ?? []).map((projection) => projection.projectionId)
    expect(new Set(projectionIds).size).toBe(3)
  })

  test('farm stand projection views share one source module program id and are not independent source modules', () => {
    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })

    const sourceModuleIds = new Set(
      (decision.descriptor?.declaredProjections ?? []).map((projection) => projection.sourceModuleId),
    )

    expect(sourceModuleIds.size).toBe(1)
    expect(Array.from(sourceModuleIds)[0]).toBe('farm-stand')
    expect(decision.descriptor?.programId).toBe('farm-stand')
  })

  test('rejects descriptor when declared projection source module id mismatches descriptor source module id', () => {
    const descriptor = createDescriptor()
    const firstProjection = descriptor.declaredProjections[0]
    expect(firstProjection).toBeDefined()
    descriptor.declaredProjections[0] = {
      ...firstProjection!,
      sourceModuleId: 'other-source-module',
    }

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('projection-source-module-mismatch')
    expect(decision.diagnostics[0]).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'projection_source_module_mismatch',
      }),
    )
  })

  test('preserves module-projection-read access requests as data', () => {
    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.declaredAccessRequests[0]).toEqual({
      kind: 'module-projection-read',
      targetModuleId: 'inventory-hub',
      projectionId: 'inventory-hub-supplier-v1',
      reason: 'Needs supplier-facing inventory state.',
    })
  })

  test('broad unrestricted module state read declaration produces needs_review', () => {
    const descriptor = createDescriptor()
    descriptor.declaredAccessRequests = [
      {
        kind: 'module-read',
        targetModuleId: 'farm-stand',
        scope: 'unrestricted',
        reason: 'Needs full access to farm stand state.',
      },
    ]

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('needs_review')
    expect(decision.reason).toBe('declared-access-review-required')
    expect(decision.requirements[0]).toEqual(
      expect.objectContaining({
        kind: 'access-review',
        accessKinds: ['module-read'],
      }),
    )
  })

  test('read-only skill-use declaration is preserved as data and does not invoke skills', () => {
    const descriptor = createDescriptor()
    descriptor.declaredAccessRequests = [
      {
        kind: 'skill-use',
        skillName: 'plaited-context',
        access: 'read',
        reason: 'Needs source-grounded context assembly.',
      },
    ]

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.declaredAccessRequests[0]).toEqual({
      kind: 'skill-use',
      skillName: 'plaited-context',
      access: 'read',
      reason: 'Needs source-grounded context assembly.',
    })
  })

  test('read-only cli-use declaration is preserved as data and does not execute commands', () => {
    const descriptor = createDescriptor()
    descriptor.declaredAccessRequests = [
      {
        kind: 'cli-use',
        command: 'rg',
        access: 'read',
        allowedPaths: ['src', 'skills', 'docs', 'AGENTS.md'],
        reason: 'Needs read-only source search.',
      },
    ]

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('admitted')
    expect(decision.descriptor?.declaredAccessRequests[0]).toEqual({
      kind: 'cli-use',
      command: 'rg',
      access: 'read',
      allowedPaths: ['src', 'skills', 'docs', 'AGENTS.md'],
      reason: 'Needs read-only source search.',
    })
  })

  test('inference-use declaration is preserved as data and returns needs_review', () => {
    const descriptor = createDescriptor()
    descriptor.declaredAccessRequests = [
      {
        kind: 'inference-use',
        modelRole: 'planner',
        inputBoundary: 'retrieved-context',
        outputBoundary: 'proposal-only',
        reason: 'Generate plans from retrieved context.',
      },
    ]

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('needs_review')
    expect(decision.reason).toBe('declared-access-review-required')
    expect(decision.descriptor?.declaredAccessRequests[0]).toEqual({
      kind: 'inference-use',
      modelRole: 'planner',
      inputBoundary: 'retrieved-context',
      outputBoundary: 'proposal-only',
      reason: 'Generate plans from retrieved context.',
    })
  })

  test('unbounded self-spawn declaration produces needs_review', () => {
    const descriptor = createDescriptor()
    descriptor.declaredAccessRequests = [
      {
        kind: 'self-spawn',
        access: 'read',
        reason: 'Parallel read-only planning over context.',
      },
    ]

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('needs_review')
    expect(decision.reason).toBe('declared-access-review-required')
    expect(decision.requirements[0]).toEqual(
      expect.objectContaining({
        kind: 'access-review',
        accessKinds: ['self-spawn'],
      }),
    )
  })

  test('rejects forbidden process execution access declarations', () => {
    const descriptor = createDescriptor()
    descriptor.declaredAccessRequests = [
      {
        kind: 'process-execution',
        command: 'bun run dangerous',
        reason: 'Execute commands directly.',
      },
    ]

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('forbidden-declared-access-request')
    expect(decision.diagnostics[0]).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'process_execution_forbidden',
      }),
    )
  })

  test('preserves source and provenance in admission output', () => {
    const descriptor = createDescriptor()

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.descriptor?.source).toEqual(descriptor.source)
    expect(decision.descriptor?.provenance).toEqual(descriptor.provenance)
  })

  test('decision output always includes decision, reason, requirements, and diagnostics', () => {
    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })

    expect(decision).toEqual(
      expect.objectContaining({
        decision: expect.any(String),
        reason: expect.any(String),
        requirements: expect.any(Array),
        diagnostics: expect.any(Array),
      }),
    )
  })

  test('decisions and descriptors remain JSON-shaped and replay-safe', () => {
    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })

    const serialized = JSON.stringify(decision)
    const reparsed = JSON.parse(serialized)

    expect(reparsed).toEqual(decision)
  })

  test('invalid non-JSON descriptor data is rejected and diagnosed', () => {
    const descriptor = createDescriptor() as Record<string, unknown>
    const provenance = {
      ...(descriptor.provenance as Record<string, unknown>),
      invalidFn: () => 'non-json',
    }
    descriptor.provenance = provenance

    const decision = evaluateModuleProgramAdmission({ descriptor })

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('invalid-module-program-descriptor')
    expect(decision.diagnostics[0]).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'invalid_descriptor',
      }),
    )
  })

  test('admitted descriptor projection data remains compatible with projection boundary schemas', async () => {
    expect(await Bun.file('src/modules/projection-boundary-actor.ts').exists()).toBe(true)

    const decision = evaluateModuleProgramAdmission({ descriptor: createDescriptor() })
    const parsedProjections = (decision.descriptor?.declaredProjections ?? []).map((projection) =>
      ProjectionDescriptorSchema.parse(projection),
    )
    const [supplierProjection, marketOrganizerProjection, shopperProjection] = parsedProjections

    expect(parsedProjections).toHaveLength(3)
    expect(supplierProjection).toBeDefined()
    expect(marketOrganizerProjection).toBeDefined()
    expect(shopperProjection).toBeDefined()
    expect(supplierProjection?.projectionId).toBe('farm-stand-supplier-v1')
    expect(marketOrganizerProjection?.projectionId).toBe('farm-stand-market-organizer-v1')
    expect(shopperProjection?.projectionId).toBe('farm-stand-shopper-v1')
  })
})
