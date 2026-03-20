import * as z from 'zod'

import {
  LINK_ACTIVITY_KINDS,
  MSS_BOUNDARIES,
  MSS_MECHANICS,
  MSS_SCALES,
  MSS_STRUCTURES,
  RUNTIME_TAXONOMY,
  TEAM_ROUTE_ACTIVITY_KINDS,
} from './runtime.constants.ts'

/**
 * MSS content type.
 *
 * @public
 */
export const ContentTypeSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .describe('Lowercase MSS content type used for network grouping')

/**
 * MSS structure.
 *
 * @public
 */
export const StructureSchema = z.enum(MSS_STRUCTURES)

/**
 * MSS mechanic.
 *
 * @public
 */
export const MechanicSchema = z.enum(MSS_MECHANICS)

/**
 * MSS boundary.
 *
 * @public
 */
export const BoundarySchema = z.enum(MSS_BOUNDARIES)

/**
 * MSS scale.
 *
 * @public
 */
export const ScaleSchema = z.enum(MSS_SCALES)

/**
 * Contract descriptor attached to runtime objects when they expose governed capabilities.
 *
 * @public
 */
export const RuntimeContractSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Structural MSS object descriptor.
 *
 * @public
 */
export const MssObjectSchema = z.object({
  kind: z.literal(RUNTIME_TAXONOMY[0]),
  id: z.string(),
  contentType: ContentTypeSchema,
  structure: StructureSchema,
  mechanics: z.array(MechanicSchema),
  boundary: BoundarySchema,
  scale: ScaleSchema,
  contracts: z.array(RuntimeContractSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Concrete implementation asset descriptor.
 *
 * @public
 */
export const RuntimeArtifactSchema = z.object({
  kind: z.literal(RUNTIME_TAXONOMY[1]),
  id: z.string(),
  artifactType: z.string(),
  uri: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Serializable behavioral actor descriptor.
 *
 * @public
 */
export const BehavioralActorDescriptorSchema = z.object({
  kind: z.literal(RUNTIME_TAXONOMY[2]),
  id: z.string(),
  object: MssObjectSchema,
  artifact: RuntimeArtifactSchema.optional(),
  governance: z
    .object({
      macFloor: z.array(z.string()),
      taskScope: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * Serializable sub-agent descriptor.
 *
 * @public
 */
export const SubAgentDescriptorSchema = z.object({
  kind: z.literal(RUNTIME_TAXONOMY[3]),
  id: z.string(),
  actor: BehavioralActorDescriptorSchema,
  parentActorId: z.string().optional(),
  governance: z
    .object({
      macFloor: z.array(z.string()),
      taskScope: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * Serializable PM descriptor.
 *
 * @public
 */
export const PmDescriptorSchema = z.object({
  kind: z.literal(RUNTIME_TAXONOMY[5]),
  id: z.string(),
})

/**
 * Serializable team descriptor.
 *
 * @public
 */
export const TeamDescriptorSchema = z.object({
  kind: z.literal(RUNTIME_TAXONOMY[4]),
  id: z.string(),
  pmId: z.string(),
  members: z.array(z.union([BehavioralActorDescriptorSchema, SubAgentDescriptorSchema])),
})

/**
 * Message envelope used by runtime links.
 *
 * @public
 */
export const LinkMessageSchema = z.object({
  type: z.string(),
  detail: z.unknown().optional(),
})

/**
 * Observable createLink activity.
 *
 * @public
 */
export const LinkActivitySchema = z.object({
  kind: z.enum(LINK_ACTIVITY_KINDS),
  linkId: z.string(),
  subscriptionId: z.string().optional(),
  message: LinkMessageSchema.optional(),
  error: z.string().optional(),
})

/**
 * Observable team route activity.
 *
 * @public
 */
export const TeamRouteActivitySchema = z.object({
  kind: z.enum(TEAM_ROUTE_ACTIVITY_KINDS),
  teamId: z.string(),
  pmId: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  eventTypes: z.array(z.string()),
  linkId: z.string().optional(),
})

export type RuntimeContract = z.infer<typeof RuntimeContractSchema>
export type MssObject = z.infer<typeof MssObjectSchema>
export type RuntimeArtifact = z.infer<typeof RuntimeArtifactSchema>
export type BehavioralActorDescriptor = z.infer<typeof BehavioralActorDescriptorSchema>
export type SubAgentDescriptor = z.infer<typeof SubAgentDescriptorSchema>
export type PmDescriptor = z.infer<typeof PmDescriptorSchema>
export type TeamDescriptor = z.infer<typeof TeamDescriptorSchema>
export type LinkActivity = z.infer<typeof LinkActivitySchema>
export type TeamRouteActivity = z.infer<typeof TeamRouteActivitySchema>
