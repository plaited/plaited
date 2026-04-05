import { describe, expect, test } from 'bun:test'
import { SERVER_FACTORY_BASELINE_ROUTE_OWNER } from '../server-factory.constants.ts'
import { ServerFactoryConfigSchema } from '../server-factory.schemas.ts'
import { formatRouteConflict, mergeRoutes } from '../server-factory.utils.ts'

describe('mergeRoutes', () => {
  test('returns empty routes when baseline and contributions are empty', () => {
    const result = mergeRoutes({}, {})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.routes)).toHaveLength(0)
    }
  })

  test('returns baseline routes when no contributions are present', () => {
    const result = mergeRoutes({ '/health': new Response('OK') }, {})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.routes)).toEqual(['/health'])
    }
  })

  test('merges distinct routes from multiple contributors', () => {
    const result = mergeRoutes(
      { '/health': new Response('OK') },
      {
        'contrib-b': { '/b': new Response('B') },
        'contrib-a': { '/a': new Response('A') },
      },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.routes)).toEqual(['/health', '/a', '/b'])
    }
  })

  test('reports baseline conflicts explicitly', () => {
    const result = mergeRoutes(
      { '/health': new Response('OK') },
      {
        'contrib-a': { '/health': new Response('CONFLICT') },
      },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.conflicts).toHaveLength(1)
      expect(formatRouteConflict(result.conflicts[0]!)).toBe('/health (baseline, contrib-a)')
    }
  })

  test('reports contributor conflicts in sorted order', () => {
    const result = mergeRoutes(
      { '/z': new Response('Z') },
      {
        'contrib-b': { '/z': new Response('Z2'), '/b': new Response('B2') },
        'contrib-a': { '/b': new Response('B') },
      },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.conflicts.map((conflict) => conflict.path)).toEqual(['/b', '/z'])
      expect(formatRouteConflict(result.conflicts[0]!)).toBe('/b (contrib-a, contrib-b)')
    }
  })
})

describe('ServerFactoryConfigSchema', () => {
  test('rejects the reserved baseline contributor id', () => {
    const result = ServerFactoryConfigSchema.safeParse({
      routes: {},
      routeContributions: {
        [SERVER_FACTORY_BASELINE_ROUTE_OWNER]: { '/health': new Response('BAD') },
      },
      authenticateConnection: () => ({ connectionId: 'test-connection' }),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(SERVER_FACTORY_BASELINE_ROUTE_OWNER)
    }
  })
})
