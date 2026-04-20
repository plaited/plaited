import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { behavioral, SNAPSHOT_MESSAGE_KINDS, type SnapshotMessage, useInstaller } from '../../behavioral.ts'
import { projectionBoundaryActorExtension } from '../../modules.ts'
import {
  PROJECTION_BOUNDARY_ACTOR_EVENTS,
  type ProjectionDecisionDetail,
  ProjectionDecisionDetailSchema,
  type ProjectionDescriptor,
  ProjectionDescriptorSchema,
  type ProjectionRequest,
  ProjectionRequestSchema,
  toProjectionBoundaryActorEventType,
} from '../projection-boundary-actor.ts'

type ObservedEvent = { type: string; detail?: unknown }
type Harness = {
  events: ObservedEvent[]
  snapshots: SnapshotMessage[]
  trigger: (event: { type: string; detail?: unknown }) => void
}

const descriptorRegisterEventType = toProjectionBoundaryActorEventType(
  PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_descriptor_register,
)
const descriptorRegisteredEventType = toProjectionBoundaryActorEventType(
  PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_descriptor_registered,
)
const requestEvaluateEventType = toProjectionBoundaryActorEventType(
  PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_request_evaluate,
)
const decisionEventType = toProjectionBoundaryActorEventType(PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_decision)

const ramStandSupplierDescriptor: ProjectionDescriptor = ProjectionDescriptorSchema.parse({
  projectionId: 'ram-stand-supplier-v1',
  sourceModuleId: 'ram-stand',
  audience: {
    kind: 'supplier-network',
    id: 'supplier-network-1',
  },
  shape: {
    fields: ['supplierSku', 'inventoryStatus', 'reorderThreshold'],
    facts: ['stock-level'],
    resources: ['purchase-orders'],
  },
  provenance: {
    sourceId: 'ram-stand-private-state',
    sourceModuleId: 'ram-stand',
    lineage: ['stock-feed', 'ops-console'],
  },
})

const ramStandSupplierScopedDescriptor: ProjectionDescriptor = ProjectionDescriptorSchema.parse({
  projectionId: 'ram-stand-supplier-scoped-v1',
  sourceModuleId: 'ram-stand',
  audience: {
    kind: 'supplier-network',
    id: 'supplier-network-1',
  },
  shape: {
    fields: ['supplierSku'],
    facts: ['stock-level'],
    resources: ['purchase-orders'],
  },
  scope: {
    region: 'us-west',
    channel: 'supplier-network',
    controls: {
      exportClass: 'regulated',
    },
  },
  provenance: {
    sourceId: 'ram-stand-private-state',
    sourceModuleId: 'ram-stand',
  },
})

const ramStandCustomerDescriptor: ProjectionDescriptor = ProjectionDescriptorSchema.parse({
  projectionId: 'ram-stand-customer-v1',
  sourceModuleId: 'ram-stand',
  audience: {
    kind: 'customer-network',
    id: 'customer-network-1',
  },
  shape: {
    fields: ['catalogTitle', 'availableForOrder'],
    facts: ['public-stock-band'],
    resources: ['catalog'],
  },
  provenance: {
    sourceId: 'ram-stand-private-state',
    sourceModuleId: 'ram-stand',
  },
})

const ramStandOrganizerDescriptor: ProjectionDescriptor = ProjectionDescriptorSchema.parse({
  projectionId: 'ram-stand-organizer-v1',
  sourceModuleId: 'ram-stand',
  audience: {
    kind: 'market-organizer-network',
    id: 'market-organizer-network-1',
  },
  shape: {
    fields: ['boothId', 'inspectionStatus'],
    facts: ['compliance-attestation'],
    resources: ['logistics-manifest'],
  },
  provenance: {
    sourceId: 'ram-stand-private-state',
    sourceModuleId: 'ram-stand',
  },
})

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

  useFeedback(install(projectionBoundaryActorExtension))
  useFeedback({
    [descriptorRegisteredEventType]: (detail: unknown) => {
      events.push({ type: descriptorRegisteredEventType, detail })
    },
    [decisionEventType]: (detail: unknown) => {
      events.push({ type: decisionEventType, detail })
    },
  })
  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })

  return { events, snapshots, trigger }
}

const waitForEvent = async ({
  events,
  type,
  after = 0,
  timeoutMs = 3_000,
}: {
  events: ObservedEvent[]
  type: string
  after?: number
  timeoutMs?: number
}) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const match = events.slice(after).find((event) => event.type === type)
    if (match) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for event "${type}"`)
}

const waitForFeedbackError = async ({
  snapshots,
  type,
  after = 0,
  timeoutMs = 3_000,
}: {
  snapshots: SnapshotMessage[]
  type: string
  after?: number
  timeoutMs?: number
}) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const match = snapshots
      .slice(after)
      .find((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error && snapshot.type === type)
    if (match && match.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for feedback_error snapshot for "${type}"`)
}

const registerDescriptor = (harness: Harness, descriptor: ProjectionDescriptor) => {
  harness.trigger({
    type: descriptorRegisterEventType,
    detail: {
      descriptor,
    },
  })
}

const evaluateRequest = async ({
  harness,
  request,
  after,
}: {
  harness: Harness
  request: ProjectionRequest
  after?: number
}) => {
  const before = after ?? harness.events.length
  harness.trigger({
    type: requestEvaluateEventType,
    detail: request,
  })
  const decisionEvent = await waitForEvent({
    events: harness.events,
    type: decisionEventType,
    after: before,
  })
  return ProjectionDecisionDetailSchema.parse(decisionEvent.detail)
}

const createRamStandRequest = ({
  projectionId = ramStandSupplierDescriptor.projectionId,
  requester = ramStandSupplierDescriptor.audience,
  moduleSharingPolicy = 'all',
  sourceModuleId = 'ram-stand',
  requestedShape,
  scope,
}: {
  projectionId?: string
  requester?: ProjectionDescriptor['audience']
  moduleSharingPolicy?: ProjectionRequest['moduleSharingPolicy']
  sourceModuleId?: string
  requestedShape?: ProjectionRequest['requestedShape']
  scope?: ProjectionRequest['scope']
} = {}) =>
  ProjectionRequestSchema.parse({
    requestId: `req-${Math.random().toString(36).slice(2)}`,
    correlationId: `corr-${Math.random().toString(36).slice(2)}`,
    sourceModuleId,
    projectionId,
    requester,
    moduleSharingPolicy,
    ...(requestedShape && { requestedShape }),
    ...(scope && { scope }),
    provenance: {
      sourceId: 'ram-stand-private-state',
      sourceModuleId: 'ram-stand',
    },
  })

describe('projection boundary actor extension', () => {
  test('keeps a flat actor file and does not create a nested projection implementation folder', async () => {
    expect(await Bun.file('src/modules/projection-boundary-actor.ts').exists()).toBe(true)
    expect(existsSync('src/modules/projection-boundary-actor')).toBe(false)
  })

  test('module sharing policy all allows a valid approved RAM Stand supplier projection', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        moduleSharingPolicy: 'all',
        requestedShape: {
          fields: ['supplierSku'],
          facts: ['stock-level'],
          resources: ['purchase-orders'],
        },
      }),
    })

    expect(decision.decision).toBe('allow')
    expect(decision.reason).toBe('module-sharing-policy-all-approved-projection')
    expect(decision.requirements).toEqual([])
    expect(decision.approvedShape).toEqual({
      fields: ['supplierSku'],
      facts: ['stock-level'],
      resources: ['purchase-orders'],
    })
  })

  test('matching descriptor and request scope allows under module sharing policy all', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierScopedDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandSupplierScopedDescriptor.projectionId,
        requester: ramStandSupplierScopedDescriptor.audience,
        moduleSharingPolicy: 'all',
        scope: {
          region: 'us-west',
          channel: 'supplier-network',
          controls: {
            exportClass: 'regulated',
          },
          requestId: 'scope-extra-ok',
        },
      }),
    })

    expect(decision.decision).toBe('allow')
    expect(decision.reason).toBe('module-sharing-policy-all-approved-projection')
  })

  test('missing request scope denies when descriptor scope exists', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierScopedDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandSupplierScopedDescriptor.projectionId,
        requester: ramStandSupplierScopedDescriptor.audience,
        moduleSharingPolicy: 'all',
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('projection-scope-mismatch')
    expect(decision.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'auth-grant',
          projectionId: ramStandSupplierScopedDescriptor.projectionId,
          expectedScope: ramStandSupplierScopedDescriptor.scope,
          actualScope: null,
        }),
      ]),
    )
  })

  test('mismatched request scope denies when descriptor scope exists', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierScopedDescriptor)

    const mismatchedScope = {
      region: 'us-east',
      channel: 'supplier-network',
      controls: {
        exportClass: 'regulated',
      },
    }
    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandSupplierScopedDescriptor.projectionId,
        requester: ramStandSupplierScopedDescriptor.audience,
        moduleSharingPolicy: 'all',
        scope: mismatchedScope,
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('projection-scope-mismatch')
    expect(decision.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'auth-grant',
          projectionId: ramStandSupplierScopedDescriptor.projectionId,
          expectedScope: ramStandSupplierScopedDescriptor.scope,
          actualScope: mismatchedScope,
        }),
      ]),
    )
  })

  test('module sharing policy all does not bypass scope mismatch', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierScopedDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandSupplierScopedDescriptor.projectionId,
        requester: ramStandSupplierScopedDescriptor.audience,
        moduleSharingPolicy: 'all',
        scope: {
          region: 'us-west',
          channel: 'supplier-network',
        },
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('projection-scope-mismatch')
  })

  test('partial requested shape with only fields does not inherit descriptor facts or resources', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        moduleSharingPolicy: 'all',
        requestedShape: {
          fields: ['supplierSku'],
        },
      }),
    })

    expect(decision.decision).toBe('allow')
    expect(decision.approvedShape).toEqual({
      fields: ['supplierSku'],
      facts: [],
      resources: [],
    })
  })

  test('module sharing policy none denies projection of source module data', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        moduleSharingPolicy: 'none',
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('module-sharing-policy-none')
    expect(decision.requirements).toEqual([])
  })

  test('module sharing policy ask returns ask with human-confirmation requirement', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        moduleSharingPolicy: 'ask',
      }),
    })

    expect(decision.decision).toBe('ask')
    expect(decision.reason).toBe('module-sharing-policy-ask')
    expect(decision.requirements).toHaveLength(1)
    expect(decision.requirements[0]).toEqual(
      expect.objectContaining({
        kind: 'human-confirmation',
      }),
    )
  })

  test('all does not expose RAM Stand fields outside the approved projection descriptor shape', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        moduleSharingPolicy: 'all',
        requestedShape: {
          fields: ['supplierSku', 'secretMargin'],
          facts: ['stock-level'],
          resources: ['purchase-orders'],
        },
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('projection-shape-outside-approved')
    expect(decision.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'projection-descriptor',
        }),
      ]),
    )
  })

  test('audience-specific RAM Stand projection descriptors remain distinct', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)
    registerDescriptor(harness, ramStandCustomerDescriptor)
    registerDescriptor(harness, ramStandOrganizerDescriptor)

    const supplierDecision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandSupplierDescriptor.projectionId,
        requester: ramStandSupplierDescriptor.audience,
      }),
    })
    expect(supplierDecision.decision).toBe('allow')

    const customerDecision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandCustomerDescriptor.projectionId,
        requester: ramStandCustomerDescriptor.audience,
      }),
    })
    expect(customerDecision.decision).toBe('allow')

    const organizerDecision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandOrganizerDescriptor.projectionId,
        requester: ramStandOrganizerDescriptor.audience,
      }),
    })
    expect(organizerDecision.decision).toBe('allow')

    const mismatchDecision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: ramStandSupplierDescriptor.projectionId,
        requester: ramStandCustomerDescriptor.audience,
      }),
    })
    expect(mismatchDecision.decision).toBe('deny')
    expect(mismatchDecision.reason).toBe('projection-audience-mismatch')
  })

  test('unknown projection id denies projection request', async () => {
    const harness = createHarness()

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        projectionId: 'ram-stand-unknown-v1',
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('projection-descriptor-not-found')
  })

  test('source module mismatch denies projection request', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        sourceModuleId: 'other-module',
      }),
    })

    expect(decision.decision).toBe('deny')
    expect(decision.reason).toBe('source-module-mismatch')
  })

  test('invalid projection request emits diagnostics snapshot evidence and keeps provenance unchanged', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)
    const before = harness.snapshots.length
    const invalidRequest = {
      requestId: 'req-invalid',
      sourceModuleId: 'ram-stand',
      projectionId: ramStandSupplierDescriptor.projectionId,
      requester: ramStandSupplierDescriptor.audience,
      moduleSharingPolicy: 'all',
      provenance: {
        sourceId: 'ram-stand-private-state',
      },
    } as const

    harness.trigger({
      type: requestEvaluateEventType,
      detail: invalidRequest as unknown,
    })

    const feedbackError = await waitForFeedbackError({
      snapshots: harness.snapshots,
      type: requestEvaluateEventType,
      after: before,
    })
    expect(feedbackError.error).toContain('correlationId')
    expect(feedbackError.detail).toEqual(
      expect.objectContaining({
        provenance: expect.objectContaining({
          sourceId: 'ram-stand-private-state',
        }),
      }),
    )
  })

  test('decision output includes decision, reason, and requirements', async () => {
    const harness = createHarness()
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const decision: ProjectionDecisionDetail = await evaluateRequest({
      harness,
      request: createRamStandRequest({
        moduleSharingPolicy: 'ask',
      }),
    })

    expect(typeof decision.decision).toBe('string')
    expect(typeof decision.reason).toBe('string')
    expect(Array.isArray(decision.requirements)).toBe(true)
    expect(decision).toEqual(
      expect.objectContaining({
        decision: 'ask',
        reason: 'module-sharing-policy-ask',
      }),
    )
  })

  test('registered descriptors and decisions are replay-safe JSON-shaped data', async () => {
    const harness = createHarness()
    const beforeRegistration = harness.events.length
    registerDescriptor(harness, ramStandSupplierDescriptor)

    const registeredEvent = await waitForEvent({
      events: harness.events,
      type: descriptorRegisteredEventType,
      after: beforeRegistration,
    })
    const registeredDescriptor = ProjectionDescriptorSchema.parse(registeredEvent.detail)
    expect(JSON.parse(JSON.stringify(registeredDescriptor))).toEqual(registeredDescriptor)

    const decision = await evaluateRequest({
      harness,
      request: createRamStandRequest(),
    })
    expect(JSON.parse(JSON.stringify(decision))).toEqual(decision)
  })
})
