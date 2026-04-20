import * as z from 'zod'
import { useExtension } from '../behavioral.ts'
import { keyMirror } from '../utils.ts'
import { JsonValueSchema, ModuleSharingPolicySchema, ProjectionDescriptorSchema } from './projection-boundary-actor.ts'

export const MODULE_PROGRAM_ADMISSION_ACTOR_ID = 'module_program_admission_actor'

export const MODULE_PROGRAM_ADMISSION_ACTOR_EVENTS = keyMirror('descriptor_evaluate', 'decision')

export const toModuleProgramAdmissionActorEventType = <TEvent extends string>(
  event: TEvent,
): `${typeof MODULE_PROGRAM_ADMISSION_ACTOR_ID}:${TEvent}` => `${MODULE_PROGRAM_ADMISSION_ACTOR_ID}:${event}`

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const createJsonObjectWithShapeSchema = <TShape extends z.ZodRawShape>(shape: TShape) =>
  z
    .custom<Record<string, unknown>>((value) => isPlainRecord(value), {
      message: 'Expected a plain JSON object.',
    })
    .pipe(z.object(shape).catchall(JsonValueSchema))

const ModuleProgramAccessModeSchema = z.enum(['read', 'write', 'execute'])

export const ModuleProgramSourceSchema = createJsonObjectWithShapeSchema({
  kind: z.enum(['local-file', 'generated', 'external-reference']),
  path: z.string().min(1).optional(),
  issue: z.number().int().positive().optional(),
  commit: z.string().min(1).optional(),
})
export type ModuleProgramSource = z.infer<typeof ModuleProgramSourceSchema>

export const ModuleProgramProvenanceSchema = createJsonObjectWithShapeSchema({
  createdBy: z.string().min(1).optional(),
  createdFromIssue: z.number().int().positive().optional(),
  createdFromPrompt: z.string().min(1).optional(),
  reviewedBy: z.array(z.string().min(1)).optional(),
})
export type ModuleProgramProvenance = z.infer<typeof ModuleProgramProvenanceSchema>

export const ModuleProgramMssTagsSchema = z.object({
  content: z.array(z.string().min(1)).min(1),
  structure: z.array(z.string().min(1)).min(1),
  mechanics: z.array(z.string().min(1)).min(1),
  boundary: z.array(z.string().min(1)).min(1),
  scale: z.array(z.string().min(1)).min(1),
})
export type ModuleProgramMssTags = z.infer<typeof ModuleProgramMssTagsSchema>

const ModuleProjectionReadAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('module-projection-read'),
  targetModuleId: z.string().min(1),
  projectionId: z.string().min(1),
  reason: z.string().min(1).optional(),
})

const ModuleReadAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('module-read'),
  targetModuleId: z.string().min(1),
  scope: z.enum(['projection', 'state', 'unrestricted']).optional(),
  reason: z.string().min(1).optional(),
})

const SkillUseAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('skill-use'),
  skillName: z.string().min(1),
  access: ModuleProgramAccessModeSchema.optional(),
  reason: z.string().min(1).optional(),
})

const CliUseAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('cli-use'),
  command: z.string().min(1),
  access: ModuleProgramAccessModeSchema.optional(),
  allowedPaths: z.array(z.string().min(1)).optional(),
  reason: z.string().min(1).optional(),
})

const InferenceUseAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('inference-use'),
  modelRole: z.string().min(1),
  inputBoundary: z.string().min(1),
  outputBoundary: z.string().min(1),
  reason: z.string().min(1).optional(),
})

const SelfSpawnAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('self-spawn'),
  maxConcurrent: z.number().int().positive().optional(),
  access: ModuleProgramAccessModeSchema.optional(),
  reason: z.string().min(1).optional(),
})

const NetworkApiUseAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('network-api-use'),
  scope: z.enum(['bounded', 'unbounded']).optional(),
  allowedHosts: z.array(z.string().min(1)).optional(),
  reason: z.string().min(1).optional(),
})

const ExternalServiceReferenceAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('external-service-reference'),
  service: z.string().min(1),
  access: ModuleProgramAccessModeSchema.optional(),
  reason: z.string().min(1).optional(),
})

const ProcessExecutionAccessRequestSchema = createJsonObjectWithShapeSchema({
  kind: z.literal('process-execution'),
  command: z.string().min(1),
  reason: z.string().min(1).optional(),
})

export const ModuleProgramAccessRequestSchema = z.union([
  ModuleProjectionReadAccessRequestSchema,
  ModuleReadAccessRequestSchema,
  SkillUseAccessRequestSchema,
  CliUseAccessRequestSchema,
  InferenceUseAccessRequestSchema,
  SelfSpawnAccessRequestSchema,
  NetworkApiUseAccessRequestSchema,
  ExternalServiceReferenceAccessRequestSchema,
  ProcessExecutionAccessRequestSchema,
])
export type ModuleProgramAccessRequest = z.infer<typeof ModuleProgramAccessRequestSchema>

export const ModuleProgramValidationMetadataSchema = createJsonObjectWithShapeSchema({
  tests: z.array(z.string().min(1)).optional(),
  commands: z.array(z.string().min(1)).optional(),
  notes: z.array(z.string().min(1)).optional(),
})
export type ModuleProgramValidationMetadata = z.infer<typeof ModuleProgramValidationMetadataSchema>

export const ModuleProgramDescriptorSchema = createJsonObjectWithShapeSchema({
  programId: z.string().min(1),
  sourceModuleId: z.string().min(1).optional(),
  name: z.string().min(1),
  version: z.string().min(1),
  source: ModuleProgramSourceSchema,
  provenance: ModuleProgramProvenanceSchema,
  mssTags: ModuleProgramMssTagsSchema,
  moduleSharingPolicy: ModuleSharingPolicySchema,
  declaredProjections: z.array(ProjectionDescriptorSchema).default([]),
  declaredAccessRequests: z.array(ModuleProgramAccessRequestSchema).default([]),
  validation: ModuleProgramValidationMetadataSchema.optional(),
  notes: z.array(z.string().min(1)).optional(),
})
export type ModuleProgramDescriptor = z.infer<typeof ModuleProgramDescriptorSchema>

const ModuleProgramAdmissionRequirementKindSchema = z.enum([
  'mss-tags',
  'module-sharing-policy',
  'projection-descriptor',
  'provenance',
  'validation-evidence',
  'access-review',
  'human-review',
])

export const ModuleProgramAdmissionRequirementSchema = createJsonObjectWithShapeSchema({
  kind: ModuleProgramAdmissionRequirementKindSchema,
  fields: z.array(z.string().min(1)).optional(),
  projectionIds: z.array(z.string().min(1)).optional(),
  accessKinds: z.array(z.string().min(1)).optional(),
  message: z.string().min(1).optional(),
})
export type ModuleProgramAdmissionRequirement = z.infer<typeof ModuleProgramAdmissionRequirementSchema>

const ModuleProgramAdmissionDiagnosticSeveritySchema = z.enum(['error', 'warning', 'info'])

export const ModuleProgramAdmissionDiagnosticSchema = createJsonObjectWithShapeSchema({
  severity: ModuleProgramAdmissionDiagnosticSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
})
export type ModuleProgramAdmissionDiagnostic = z.infer<typeof ModuleProgramAdmissionDiagnosticSchema>

export const ModuleProgramAdmissionDecisionSchema = createJsonObjectWithShapeSchema({
  decision: z.enum(['admitted', 'rejected', 'needs_review']),
  reason: z.string().min(1),
  requirements: z.array(ModuleProgramAdmissionRequirementSchema),
  diagnostics: z.array(ModuleProgramAdmissionDiagnosticSchema),
  descriptor: ModuleProgramDescriptorSchema.optional(),
})
export type ModuleProgramAdmissionDecision = z.infer<typeof ModuleProgramAdmissionDecisionSchema>

type EvaluateModuleProgramAdmissionParams = {
  descriptor: unknown
}

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

const toSortedUnique = (values: Iterable<string>) => [...new Set(values)].sort()

const createAdmissionDecision = (
  decision: z.input<typeof ModuleProgramAdmissionDecisionSchema>,
): ModuleProgramAdmissionDecision => ModuleProgramAdmissionDecisionSchema.parse(decision)

const createRejectedDecisionFromValidationError = (error: z.ZodError): ModuleProgramAdmissionDecision => {
  const mssFields = toSortedUnique(
    error.issues
      .filter((issue) => issue.path[0] === 'mssTags' && typeof issue.path[1] === 'string')
      .map((issue) => String(issue.path[1])),
  )

  if (mssFields.length > 0) {
    return createAdmissionDecision({
      decision: 'rejected',
      reason: 'missing-required-mss-tags',
      requirements: [
        ModuleProgramAdmissionRequirementSchema.parse({
          kind: 'mss-tags',
          fields: mssFields,
        }),
      ],
      diagnostics: [
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'error',
          code: 'missing_mss_tags',
          message: `Module program descriptor must include non-empty MSS tags: ${mssFields.join(', ')}.`,
        }),
      ],
    })
  }

  const moduleSharingPolicyInvalid = error.issues.some((issue) => issue.path[0] === 'moduleSharingPolicy')
  if (moduleSharingPolicyInvalid) {
    return createAdmissionDecision({
      decision: 'rejected',
      reason: 'invalid-module-sharing-policy',
      requirements: [
        ModuleProgramAdmissionRequirementSchema.parse({
          kind: 'module-sharing-policy',
          fields: ['moduleSharingPolicy'],
        }),
      ],
      diagnostics: [
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'error',
          code: 'invalid_module_sharing_policy',
          message: 'Module program descriptor must declare moduleSharingPolicy as all, none, or ask.',
        }),
      ],
    })
  }

  return createAdmissionDecision({
    decision: 'rejected',
    reason: 'invalid-module-program-descriptor',
    requirements: [
      ModuleProgramAdmissionRequirementSchema.parse({
        kind: 'human-review',
        message: 'Fix schema validation errors before admission.',
      }),
    ],
    diagnostics: [
      ModuleProgramAdmissionDiagnosticSchema.parse({
        severity: 'error',
        code: 'invalid_descriptor',
        message: formatValidationError(error),
      }),
    ],
  })
}

const classifyDeclaredAccessRequest = ({
  accessRequest,
  reviewAccessKinds,
  forbiddenAccessKinds,
  diagnostics,
}: {
  accessRequest: ModuleProgramAccessRequest
  reviewAccessKinds: Set<string>
  forbiddenAccessKinds: Set<string>
  diagnostics: ModuleProgramAdmissionDiagnostic[]
}) => {
  switch (accessRequest.kind) {
    case 'module-projection-read':
      return
    case 'module-read':
      reviewAccessKinds.add(accessRequest.kind)
      diagnostics.push(
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'warning',
          code: 'module_read_requires_projection_boundary',
          message: 'Broad module-read declarations must be reviewed and narrowed to projection reads when possible.',
        }),
      )
      return
    case 'skill-use':
      if (accessRequest.access !== 'read') {
        reviewAccessKinds.add(accessRequest.kind)
        diagnostics.push(
          ModuleProgramAdmissionDiagnosticSchema.parse({
            severity: 'warning',
            code: 'skill_access_review_required',
            message: 'Skill-use declarations must be read-only or reviewed before admission.',
          }),
        )
      }
      return
    case 'cli-use':
      if (accessRequest.access !== 'read' || !accessRequest.allowedPaths || accessRequest.allowedPaths.length === 0) {
        reviewAccessKinds.add(accessRequest.kind)
        diagnostics.push(
          ModuleProgramAdmissionDiagnosticSchema.parse({
            severity: 'warning',
            code: 'cli_access_review_required',
            message: 'CLI declarations must be read-only and path-bounded or they require review.',
          }),
        )
      }
      return
    case 'inference-use':
      reviewAccessKinds.add(accessRequest.kind)
      diagnostics.push(
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'warning',
          code: 'inference_access_review_required',
          message: 'Inference-use declarations are metadata only and require later runtime policy review.',
        }),
      )
      return
    case 'self-spawn':
      if (accessRequest.maxConcurrent === undefined || accessRequest.maxConcurrent > 8) {
        reviewAccessKinds.add(accessRequest.kind)
        diagnostics.push(
          ModuleProgramAdmissionDiagnosticSchema.parse({
            severity: 'warning',
            code: 'self_spawn_bounds_required',
            message: 'Self-spawn declarations must include bounded maxConcurrent limits.',
          }),
        )
      }
      return
    case 'network-api-use':
      if (accessRequest.scope !== 'bounded' || !accessRequest.allowedHosts || accessRequest.allowedHosts.length === 0) {
        reviewAccessKinds.add(accessRequest.kind)
        diagnostics.push(
          ModuleProgramAdmissionDiagnosticSchema.parse({
            severity: 'warning',
            code: 'network_access_review_required',
            message: 'Network/API declarations must be bounded and reviewed by a later grant policy path.',
          }),
        )
      }
      return
    case 'external-service-reference':
      reviewAccessKinds.add(accessRequest.kind)
      diagnostics.push(
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'warning',
          code: 'external_service_review_required',
          message: 'External service declarations require policy review before runtime grants.',
        }),
      )
      return
    case 'process-execution':
      forbiddenAccessKinds.add(accessRequest.kind)
      diagnostics.push(
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'error',
          code: 'process_execution_forbidden',
          message: 'Module Program Admission Actor does not grant or run process execution.',
        }),
      )
      return
    default: {
      const exhaustive: never = accessRequest
      return exhaustive
    }
  }
}

export const evaluateModuleProgramAdmission = ({
  descriptor,
}: EvaluateModuleProgramAdmissionParams): ModuleProgramAdmissionDecision => {
  const descriptorResult = ModuleProgramDescriptorSchema.safeParse(descriptor)
  if (!descriptorResult.success) {
    return createRejectedDecisionFromValidationError(descriptorResult.error)
  }

  const parsedDescriptor = descriptorResult.data
  const sourceModuleId = parsedDescriptor.sourceModuleId ?? parsedDescriptor.programId

  const mismatchedProjectionIds = parsedDescriptor.declaredProjections
    .filter((projection) => projection.sourceModuleId !== sourceModuleId)
    .map((projection) => projection.projectionId)

  if (mismatchedProjectionIds.length > 0) {
    return createAdmissionDecision({
      decision: 'rejected',
      reason: 'projection-source-module-mismatch',
      requirements: [
        ModuleProgramAdmissionRequirementSchema.parse({
          kind: 'projection-descriptor',
          projectionIds: mismatchedProjectionIds,
          message: `Declared projection source module must match ${sourceModuleId}.`,
        }),
      ],
      diagnostics: [
        ModuleProgramAdmissionDiagnosticSchema.parse({
          severity: 'error',
          code: 'projection_source_module_mismatch',
          message: `Projection descriptors must use sourceModuleId="${sourceModuleId}".`,
        }),
      ],
      descriptor: parsedDescriptor,
    })
  }

  const diagnostics: ModuleProgramAdmissionDiagnostic[] = []
  const reviewAccessKinds = new Set<string>()
  const forbiddenAccessKinds = new Set<string>()

  for (const accessRequest of parsedDescriptor.declaredAccessRequests) {
    classifyDeclaredAccessRequest({
      accessRequest,
      reviewAccessKinds,
      forbiddenAccessKinds,
      diagnostics,
    })
  }

  if (forbiddenAccessKinds.size > 0) {
    return createAdmissionDecision({
      decision: 'rejected',
      reason: 'forbidden-declared-access-request',
      requirements: [
        ModuleProgramAdmissionRequirementSchema.parse({
          kind: 'access-review',
          accessKinds: toSortedUnique(forbiddenAccessKinds),
          message: 'Remove forbidden access declarations from this descriptor.',
        }),
      ],
      diagnostics,
      descriptor: parsedDescriptor,
    })
  }

  if (reviewAccessKinds.size > 0) {
    return createAdmissionDecision({
      decision: 'needs_review',
      reason: 'declared-access-review-required',
      requirements: [
        ModuleProgramAdmissionRequirementSchema.parse({
          kind: 'access-review',
          accessKinds: toSortedUnique(reviewAccessKinds),
          message: 'Declared access requests require later runtime policy review.',
        }),
      ],
      diagnostics,
      descriptor: parsedDescriptor,
    })
  }

  return createAdmissionDecision({
    decision: 'admitted',
    reason: 'module-program-descriptor-valid',
    requirements: [],
    diagnostics: [],
    descriptor: parsedDescriptor,
  })
}

export const moduleProgramAdmissionActorExtension = useExtension(MODULE_PROGRAM_ADMISSION_ACTOR_ID, ({ trigger }) => {
  return {
    [MODULE_PROGRAM_ADMISSION_ACTOR_EVENTS.descriptor_evaluate](detail: unknown) {
      const decision = evaluateModuleProgramAdmission({ descriptor: detail })
      trigger({
        type: MODULE_PROGRAM_ADMISSION_ACTOR_EVENTS.decision,
        detail: decision,
      })
    },
  }
})
