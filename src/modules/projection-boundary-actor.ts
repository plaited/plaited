import * as z from 'zod'
import { useExtension } from '../behavioral.ts'
import { keyMirror } from '../utils.ts'

export const PROJECTION_BOUNDARY_ACTOR_ID = 'projection_boundary_actor'

export const PROJECTION_BOUNDARY_ACTOR_EVENTS = keyMirror(
  'projection_descriptor_register',
  'projection_descriptor_registered',
  'projection_request_evaluate',
  'projection_decision',
)

export const toProjectionBoundaryActorEventType = <TEvent extends string>(
  event: TEvent,
): `${typeof PROJECTION_BOUNDARY_ACTOR_ID}:${TEvent}` => `${PROJECTION_BOUNDARY_ACTOR_ID}:${event}`

export const ModuleSharingPolicySchema = z.enum(['all', 'none', 'ask'])
export type ModuleSharingPolicy = z.infer<typeof ModuleSharingPolicySchema>

export const ProjectionDecisionSchema = z.enum(['allow', 'deny', 'ask'])
export type ProjectionDecision = z.infer<typeof ProjectionDecisionSchema>

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z
      .custom<Record<string, unknown>>((value) => isPlainRecord(value), {
        message: 'Expected a plain JSON object.',
      })
      .pipe(z.record(z.string(), JsonValueSchema)),
  ]),
)

const createJsonObjectWithShapeSchema = <TShape extends z.ZodRawShape>(shape: TShape) =>
  z
    .custom<Record<string, unknown>>((value) => isPlainRecord(value), {
      message: 'Expected a plain JSON object.',
    })
    .pipe(z.object(shape).catchall(JsonValueSchema))

export const ProjectionAudienceSchema = createJsonObjectWithShapeSchema({
  id: z.string().min(1).optional(),
  kind: z.string().min(1),
})
export type ProjectionAudience = z.infer<typeof ProjectionAudienceSchema>

export const ProjectionShapeSchema = z.object({
  fields: z.array(z.string().min(1)).default([]),
  facts: z.array(z.string().min(1)).default([]),
  resources: z.array(z.string().min(1)).default([]),
})
export type ProjectionShape = z.infer<typeof ProjectionShapeSchema>

export const RequestedProjectionShapeSchema = z.object({
  fields: z.array(z.string().min(1)).optional(),
  facts: z.array(z.string().min(1)).optional(),
  resources: z.array(z.string().min(1)).optional(),
})
export type RequestedProjectionShape = z.infer<typeof RequestedProjectionShapeSchema>

export const ProjectionScopeSchema = z
  .custom<Record<string, unknown>>((value) => isPlainRecord(value), {
    message: 'Expected a plain JSON object.',
  })
  .pipe(z.record(z.string(), JsonValueSchema))
export type ProjectionScope = z.infer<typeof ProjectionScopeSchema>

export const ProjectionProvenanceSchema = createJsonObjectWithShapeSchema({
  sourceId: z.string().min(1).optional(),
  sourceModuleId: z.string().min(1).optional(),
  lineage: z.array(z.string().min(1)).optional(),
})
export type ProjectionProvenance = z.infer<typeof ProjectionProvenanceSchema>

export const ProjectionDescriptorSchema = z.object({
  projectionId: z.string().min(1),
  sourceModuleId: z.string().min(1),
  audience: ProjectionAudienceSchema,
  shape: ProjectionShapeSchema,
  scope: ProjectionScopeSchema.optional(),
  provenance: ProjectionProvenanceSchema.optional(),
})
export type ProjectionDescriptor = z.infer<typeof ProjectionDescriptorSchema>

export const ProjectionDescriptorRegistrationSchema = z.object({
  descriptor: ProjectionDescriptorSchema,
})
export type ProjectionDescriptorRegistration = z.infer<typeof ProjectionDescriptorRegistrationSchema>

export const ProjectionRequestSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  sourceModuleId: z.string().min(1),
  projectionId: z.string().min(1),
  requester: ProjectionAudienceSchema,
  moduleSharingPolicy: ModuleSharingPolicySchema,
  requestedShape: RequestedProjectionShapeSchema.optional(),
  scope: ProjectionScopeSchema.optional(),
  provenance: ProjectionProvenanceSchema.optional(),
})
export type ProjectionRequest = z.infer<typeof ProjectionRequestSchema>

export const ProjectionRequirementSchema = createJsonObjectWithShapeSchema({
  kind: z.string().min(1),
})
export type ProjectionRequirement = z.infer<typeof ProjectionRequirementSchema>

export const ProjectionDecisionDetailSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  sourceModuleId: z.string().min(1),
  projectionId: z.string().min(1),
  decision: ProjectionDecisionSchema,
  reason: z.string().min(1),
  requirements: z.array(ProjectionRequirementSchema),
  approvedShape: ProjectionShapeSchema.optional(),
  audience: ProjectionAudienceSchema.optional(),
  requestProvenance: ProjectionProvenanceSchema.optional(),
  descriptorProvenance: ProjectionProvenanceSchema.optional(),
})
export type ProjectionDecisionDetail = z.infer<typeof ProjectionDecisionDetailSchema>

type EvaluateProjectionRequestParams = {
  request: ProjectionRequest
  descriptorLookup: ReadonlyMap<string, ProjectionDescriptor>
}

const isJsonEqual = (left: unknown, right: unknown): boolean => {
  if (left === null || right === null) {
    return left === right
  }

  const leftType = typeof left
  const rightType = typeof right
  if (leftType !== rightType) {
    return false
  }

  if (leftType === 'string' || leftType === 'number' || leftType === 'boolean') {
    return Object.is(left, right)
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((value, index) => isJsonEqual(value, right[index]))
  }

  if (isPlainRecord(left) && isPlainRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    return leftKeys.every((key) => Object.hasOwn(right, key) && isJsonEqual(left[key], right[key]))
  }

  return false
}

const isScopeCompatible = ({
  descriptorScope,
  requestScope,
}: {
  descriptorScope: ProjectionScope
  requestScope: ProjectionScope | undefined
}) => {
  if (!requestScope) {
    return false
  }

  for (const [scopeKey, descriptorValue] of Object.entries(descriptorScope)) {
    if (!Object.hasOwn(requestScope, scopeKey)) {
      return false
    }
    const requestValue = requestScope[scopeKey]
    if (!isJsonEqual(descriptorValue, requestValue)) {
      return false
    }
  }

  return true
}

const isAudienceMatch = ({
  descriptorAudience,
  requesterAudience,
}: {
  descriptorAudience: ProjectionAudience
  requesterAudience: ProjectionAudience
}) => {
  if (descriptorAudience.kind !== requesterAudience.kind) {
    return false
  }

  if (descriptorAudience.id === undefined) {
    return true
  }

  return descriptorAudience.id === requesterAudience.id
}

const isRequestedShapeWithinDescriptor = ({
  requestedShape,
  descriptorShape,
}: {
  requestedShape: RequestedProjectionShape | undefined
  descriptorShape: ProjectionShape
}) => {
  if (!requestedShape) {
    return true
  }

  const within = <TValue extends string>(requested: TValue[] | undefined, allowed: TValue[]) => {
    if (!requested) {
      return true
    }
    const allowedSet = new Set(allowed)
    return requested.every((candidate) => allowedSet.has(candidate))
  }

  return (
    within(requestedShape.fields, descriptorShape.fields) &&
    within(requestedShape.facts, descriptorShape.facts) &&
    within(requestedShape.resources, descriptorShape.resources)
  )
}

const toApprovedShape = ({
  descriptorShape,
  requestedShape,
}: {
  descriptorShape: ProjectionShape
  requestedShape: RequestedProjectionShape | undefined
}): ProjectionShape => {
  if (!requestedShape) {
    return descriptorShape
  }

  return {
    fields: requestedShape.fields ?? [],
    facts: requestedShape.facts ?? [],
    resources: requestedShape.resources ?? [],
  }
}

const createDecisionDetail = ({
  request,
  descriptor,
  decision,
  reason,
  requirements,
  includeApprovedShape = false,
}: {
  request: ProjectionRequest
  descriptor?: ProjectionDescriptor
  decision: ProjectionDecision
  reason: string
  requirements: ProjectionRequirement[]
  includeApprovedShape?: boolean
}): ProjectionDecisionDetail =>
  ProjectionDecisionDetailSchema.parse({
    requestId: request.requestId,
    correlationId: request.correlationId,
    sourceModuleId: request.sourceModuleId,
    projectionId: request.projectionId,
    decision,
    reason,
    requirements,
    ...(descriptor && {
      audience: descriptor.audience,
      descriptorProvenance: descriptor.provenance,
    }),
    ...(request.provenance && {
      requestProvenance: request.provenance,
    }),
    ...(descriptor &&
      includeApprovedShape && {
        approvedShape: toApprovedShape({
          descriptorShape: descriptor.shape,
          requestedShape: request.requestedShape,
        }),
      }),
  })

export const evaluateProjectionRequest = ({
  request,
  descriptorLookup,
}: EvaluateProjectionRequestParams): ProjectionDecisionDetail => {
  const descriptor = descriptorLookup.get(request.projectionId)
  if (!descriptor) {
    return createDecisionDetail({
      request,
      decision: 'deny',
      reason: 'projection-descriptor-not-found',
      requirements: [
        ProjectionRequirementSchema.parse({
          kind: 'projection-descriptor',
          projectionId: request.projectionId,
          message: 'Register a projection descriptor before evaluating requests.',
        }),
      ],
    })
  }

  if (descriptor.sourceModuleId !== request.sourceModuleId) {
    return createDecisionDetail({
      request,
      descriptor,
      decision: 'deny',
      reason: 'source-module-mismatch',
      requirements: [
        ProjectionRequirementSchema.parse({
          kind: 'projection-descriptor',
          projectionId: request.projectionId,
          expectedSourceModuleId: descriptor.sourceModuleId,
          actualSourceModuleId: request.sourceModuleId,
        }),
      ],
    })
  }

  if (
    descriptor.scope &&
    !isScopeCompatible({
      descriptorScope: descriptor.scope,
      requestScope: request.scope,
    })
  ) {
    return createDecisionDetail({
      request,
      descriptor,
      decision: 'deny',
      reason: 'projection-scope-mismatch',
      requirements: [
        ProjectionRequirementSchema.parse({
          kind: 'auth-grant',
          projectionId: request.projectionId,
          message: 'Projection request scope does not satisfy descriptor scope.',
          expectedScope: descriptor.scope,
          actualScope: request.scope ?? null,
        }),
      ],
    })
  }

  if (
    !isRequestedShapeWithinDescriptor({
      requestedShape: request.requestedShape,
      descriptorShape: descriptor.shape,
    })
  ) {
    return createDecisionDetail({
      request,
      descriptor,
      decision: 'deny',
      reason: 'projection-shape-outside-approved',
      requirements: [
        ProjectionRequirementSchema.parse({
          kind: 'projection-descriptor',
          projectionId: request.projectionId,
          message: 'Requested shape exceeds approved projection descriptor.',
        }),
      ],
    })
  }

  if (
    !isAudienceMatch({
      descriptorAudience: descriptor.audience,
      requesterAudience: request.requester,
    })
  ) {
    return createDecisionDetail({
      request,
      descriptor,
      decision: 'deny',
      reason: 'projection-audience-mismatch',
      requirements: [
        ProjectionRequirementSchema.parse({
          kind: 'auth-grant',
          projectionId: request.projectionId,
          message: 'Requester audience does not match the approved projection audience.',
        }),
      ],
    })
  }

  if (request.moduleSharingPolicy === 'none') {
    return createDecisionDetail({
      request,
      descriptor,
      decision: 'deny',
      reason: 'module-sharing-policy-none',
      requirements: [],
    })
  }

  if (request.moduleSharingPolicy === 'ask') {
    return createDecisionDetail({
      request,
      descriptor,
      decision: 'ask',
      reason: 'module-sharing-policy-ask',
      requirements: [
        ProjectionRequirementSchema.parse({
          kind: 'human-confirmation',
          prompt: `Share projection "${request.projectionId}" from module "${request.sourceModuleId}" with audience "${request.requester.kind}"?`,
        }),
      ],
      includeApprovedShape: true,
    })
  }

  return createDecisionDetail({
    request,
    descriptor,
    decision: 'allow',
    reason: 'module-sharing-policy-all-approved-projection',
    requirements: [],
    includeApprovedShape: true,
  })
}

export const projectionBoundaryActorExtension = useExtension(PROJECTION_BOUNDARY_ACTOR_ID, ({ trigger }) => {
  const descriptorLookup = new Map<string, ProjectionDescriptor>()

  return {
    [PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_descriptor_register](detail: unknown) {
      const registration = ProjectionDescriptorRegistrationSchema.parse(detail)
      descriptorLookup.set(registration.descriptor.projectionId, registration.descriptor)
      trigger({
        type: PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_descriptor_registered,
        detail: registration.descriptor,
      })
    },
    [PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_request_evaluate](detail: unknown) {
      const request = ProjectionRequestSchema.parse(detail)
      const decision = evaluateProjectionRequest({
        request,
        descriptorLookup,
      })
      trigger({
        type: PROJECTION_BOUNDARY_ACTOR_EVENTS.projection_decision,
        detail: decision,
      })
    },
  }
})
