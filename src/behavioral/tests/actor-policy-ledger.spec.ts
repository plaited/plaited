import { describe, expect, test } from 'bun:test'

import {
  ActorPolicyEventSchema,
  createDefaultActorPolicyState,
  replayActorPolicyEvents,
} from '../actor-policy-ledger.ts'

describe('actor policy ledger', () => {
  test('creates default-closed actor policy state', () => {
    expect(createDefaultActorPolicyState('farm-stand')).toEqual({
      actorId: 'farm-stand',
      grants: [],
      mss: {
        boundary: [],
        content: [],
        mechanics: [],
        scale: [],
        structure: [],
      },
      projections: [],
    })
  })

  test('replays approved projection, grant, mss, and promoted code events', () => {
    const state = replayActorPolicyEvents({
      actorId: 'farm-stand',
      events: [
        {
          type: 'actor.created',
          actorId: 'farm-stand',
          codeHash: 'hash-a',
        },
        {
          type: 'mss.observed',
          actorId: 'farm-stand',
          tags: {
            content: ['produce-catalog'],
            structure: ['projection-ledger'],
            mechanics: ['inventory-update'],
            boundary: ['supplier-boundary'],
            scale: ['market-day'],
          },
        },
        {
          type: 'projection.proposed',
          actorId: 'farm-stand',
          projectionId: 'supplier-stock',
          audience: {
            kind: 'supplier',
          },
          shape: {
            fields: ['supplierSku'],
            facts: ['stock-level'],
            resources: [],
          },
        },
        {
          type: 'projection.approved',
          actorId: 'farm-stand',
          projectionId: 'supplier-stock',
          approvedBy: 'human',
        },
        {
          type: 'grant.approved',
          actorId: 'farm-stand',
          projectionId: 'supplier-stock',
          approvedBy: 'human',
          audience: {
            kind: 'supplier',
            id: 'supplier-1',
          },
          grantId: 'grant-1',
        },
        {
          type: 'code.promoted',
          actorId: 'farm-stand',
          approvedBy: 'human',
          codeHash: 'hash-b',
        },
      ],
    })

    expect(state.codeHash).toBe('hash-b')
    expect(state.mss.content).toEqual(['produce-catalog'])
    expect(state.mss.boundary).toEqual(['supplier-boundary'])
    expect(state.projections).toEqual([
      {
        actorId: 'farm-stand',
        approved: true,
        audience: {
          kind: 'supplier',
        },
        projectionId: 'supplier-stock',
        shape: {
          fields: ['supplierSku'],
          facts: ['stock-level'],
          resources: [],
        },
      },
    ])
    expect(state.grants).toEqual([
      {
        actorId: 'farm-stand',
        approvedBy: 'human',
        audience: {
          kind: 'supplier',
          id: 'supplier-1',
        },
        grantId: 'grant-1',
        projectionId: 'supplier-stock',
      },
    ])
  })

  test('rejects invalid and mismatched actor policy events', () => {
    expect(() => ActorPolicyEventSchema.parse({ type: 'projection.approved', actorId: 'farm-stand' })).toThrow()

    expect(() =>
      replayActorPolicyEvents({
        actorId: 'farm-stand',
        events: [
          {
            type: 'actor.created',
            actorId: 'other-actor',
          },
        ],
      }),
    ).toThrow('does not match')
  })
})
