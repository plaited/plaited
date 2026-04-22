import * as z from 'zod'

const ActorPolicyEventBaseSchema = z.object({
  actorId: z.string().min(1),
  at: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
})

export const ActorPolicyMssTagsSchema = z.object({
  content: z.array(z.string().min(1)).default([]),
  structure: z.array(z.string().min(1)).default([]),
  mechanics: z.array(z.string().min(1)).default([]),
  boundary: z.array(z.string().min(1)).default([]),
  scale: z.array(z.string().min(1)).default([]),
})
export type ActorPolicyMssTags = z.infer<typeof ActorPolicyMssTagsSchema>

export const ActorPolicyProjectionShapeSchema = z.object({
  fields: z.array(z.string().min(1)).default([]),
  facts: z.array(z.string().min(1)).default([]),
  resources: z.array(z.string().min(1)).default([]),
})
export type ActorPolicyProjectionShape = z.infer<typeof ActorPolicyProjectionShapeSchema>

export const ActorPolicyAudienceSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.string().min(1),
})
export type ActorPolicyAudience = z.infer<typeof ActorPolicyAudienceSchema>

const ActorCreatedPolicyEventSchema = ActorPolicyEventBaseSchema.extend({
  type: z.literal('actor.created'),
  codeHash: z.string().min(1).optional(),
})

const ActorCodePromotedPolicyEventSchema = ActorPolicyEventBaseSchema.extend({
  type: z.literal('code.promoted'),
  approvedBy: z.string().min(1),
  codeHash: z.string().min(1),
  source: z.string().min(1).optional(),
})

const ActorMssObservedPolicyEventSchema = ActorPolicyEventBaseSchema.extend({
  type: z.literal('mss.observed'),
  tags: ActorPolicyMssTagsSchema,
})

const ActorProjectionProposedPolicyEventSchema = ActorPolicyEventBaseSchema.extend({
  type: z.literal('projection.proposed'),
  projectionId: z.string().min(1),
  audience: ActorPolicyAudienceSchema.optional(),
  shape: ActorPolicyProjectionShapeSchema.optional(),
})

const ActorProjectionApprovedPolicyEventSchema = ActorPolicyEventBaseSchema.extend({
  type: z.literal('projection.approved'),
  approvedBy: z.string().min(1),
  projectionId: z.string().min(1),
  audience: ActorPolicyAudienceSchema.optional(),
  shape: ActorPolicyProjectionShapeSchema.optional(),
})

const ActorGrantApprovedPolicyEventSchema = ActorPolicyEventBaseSchema.extend({
  type: z.literal('grant.approved'),
  approvedBy: z.string().min(1),
  projectionId: z.string().min(1),
  audience: ActorPolicyAudienceSchema,
  grantId: z.string().min(1).optional(),
})

export const ActorPolicyEventSchema = z.discriminatedUnion('type', [
  ActorCreatedPolicyEventSchema,
  ActorCodePromotedPolicyEventSchema,
  ActorMssObservedPolicyEventSchema,
  ActorProjectionProposedPolicyEventSchema,
  ActorProjectionApprovedPolicyEventSchema,
  ActorGrantApprovedPolicyEventSchema,
])
export type ActorPolicyEvent = z.infer<typeof ActorPolicyEventSchema>

export type ActorPolicyProjectionState = {
  actorId: string
  approved: boolean
  audience?: ActorPolicyAudience
  projectionId: string
  shape?: ActorPolicyProjectionShape
}

export type ActorPolicyGrantState = {
  actorId: string
  approvedBy: string
  audience: ActorPolicyAudience
  grantId?: string
  projectionId: string
}

export type ActorPolicyState = {
  actorId: string
  codeHash?: string
  grants: ActorPolicyGrantState[]
  mss: ActorPolicyMssTags
  projections: ActorPolicyProjectionState[]
}

const emptyMssTags = (): ActorPolicyMssTags => ({
  boundary: [],
  content: [],
  mechanics: [],
  scale: [],
  structure: [],
})

const appendUnique = (current: string[], values: string[]) => [...new Set([...current, ...values])].sort()

const mergeMssTags = (current: ActorPolicyMssTags, next: ActorPolicyMssTags): ActorPolicyMssTags => ({
  boundary: appendUnique(current.boundary, next.boundary),
  content: appendUnique(current.content, next.content),
  mechanics: appendUnique(current.mechanics, next.mechanics),
  scale: appendUnique(current.scale, next.scale),
  structure: appendUnique(current.structure, next.structure),
})

const upsertProjection = ({
  projections,
  projection,
}: {
  projections: ActorPolicyProjectionState[]
  projection: ActorPolicyProjectionState
}) => {
  const index = projections.findIndex((candidate) => candidate.projectionId === projection.projectionId)
  if (index === -1) {
    projections.push(projection)
    return
  }
  projections[index] = {
    ...projections[index],
    ...projection,
    approved: projections[index]!.approved || projection.approved,
  }
}

export const createDefaultActorPolicyState = (actorId: string): ActorPolicyState => ({
  actorId,
  grants: [],
  mss: emptyMssTags(),
  projections: [],
})

export const replayActorPolicyEvents = ({
  actorId,
  events,
}: {
  actorId: string
  events: unknown[]
}): ActorPolicyState => {
  const state = createDefaultActorPolicyState(actorId)

  for (const event of events) {
    const parsedEvent = ActorPolicyEventSchema.parse(event)
    if (parsedEvent.actorId !== actorId) {
      throw new Error(`Actor policy event actorId "${parsedEvent.actorId}" does not match "${actorId}".`)
    }

    switch (parsedEvent.type) {
      case 'actor.created':
        state.codeHash = parsedEvent.codeHash ?? state.codeHash
        break
      case 'code.promoted':
        state.codeHash = parsedEvent.codeHash
        break
      case 'mss.observed':
        state.mss = mergeMssTags(state.mss, parsedEvent.tags)
        break
      case 'projection.proposed':
        upsertProjection({
          projections: state.projections,
          projection: {
            actorId,
            approved: false,
            projectionId: parsedEvent.projectionId,
            ...(parsedEvent.audience && { audience: parsedEvent.audience }),
            ...(parsedEvent.shape && { shape: parsedEvent.shape }),
          },
        })
        break
      case 'projection.approved':
        upsertProjection({
          projections: state.projections,
          projection: {
            actorId,
            approved: true,
            projectionId: parsedEvent.projectionId,
            ...(parsedEvent.audience && { audience: parsedEvent.audience }),
            ...(parsedEvent.shape && { shape: parsedEvent.shape }),
          },
        })
        break
      case 'grant.approved':
        state.grants.push({
          actorId,
          approvedBy: parsedEvent.approvedBy,
          audience: parsedEvent.audience,
          projectionId: parsedEvent.projectionId,
          ...(parsedEvent.grantId && { grantId: parsedEvent.grantId }),
        })
        break
      default: {
        const exhaustive: never = parsedEvent
        return exhaustive
      }
    }
  }

  state.grants.sort((left, right) => left.projectionId.localeCompare(right.projectionId))
  state.projections.sort((left, right) => left.projectionId.localeCompare(right.projectionId))
  return structuredClone(state)
}
