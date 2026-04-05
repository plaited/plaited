import { SERVER_FACTORY_BASELINE_ROUTE_OWNER } from './server-factory.constants.ts'
import type { RouteConflictOwner, RouteContributions, RouteMergeResult, ServeRoutes } from './server-factory.types.ts'

const compareConflictOwners = (left: RouteConflictOwner, right: RouteConflictOwner): number => {
  if (left.kind === 'baseline' && right.kind === 'baseline') return 0
  if (left.kind === 'baseline') return -1
  if (right.kind === 'baseline') return 1
  return left.contributorId.localeCompare(right.contributorId)
}

const createConflictOwner = (ownerId: string): RouteConflictOwner =>
  ownerId === SERVER_FACTORY_BASELINE_ROUTE_OWNER
    ? { kind: 'baseline' }
    : { kind: 'contribution', contributorId: ownerId }

const formatConflictOwner = (owner: RouteConflictOwner): string =>
  owner.kind === 'baseline' ? 'baseline' : owner.contributorId

export const formatRouteConflict = (conflict: { path: string; owners: RouteConflictOwner[] }): string => {
  const owners = [...conflict.owners].sort(compareConflictOwners).map(formatConflictOwner).join(', ')
  return `${conflict.path} (${owners})`
}

export const mergeRoutes = (routes: ServeRoutes, contributions: RouteContributions): RouteMergeResult => {
  const contributorIds = Object.keys(contributions).sort()
  const orderedContributors: Array<[string, ServeRoutes]> = [
    [SERVER_FACTORY_BASELINE_ROUTE_OWNER, routes],
    ...contributorIds.map<[string, ServeRoutes]>((contributorId) => [contributorId, contributions[contributorId]!]),
  ]

  const merged: ServeRoutes = {}
  const ownership = new Map<string, string>()
  const conflicts = new Map<string, RouteConflictOwner[]>()

  for (const [ownerId, fragment] of orderedContributors) {
    for (const path of Object.keys(fragment)) {
      const existingOwnerId = ownership.get(path)
      if (existingOwnerId === undefined) {
        ownership.set(path, ownerId)
        merged[path] = fragment[path]!
        continue
      }

      const owners = conflicts.get(path) ?? [createConflictOwner(existingOwnerId)]
      const nextOwner = createConflictOwner(ownerId)
      if (!owners.some((owner) => compareConflictOwners(owner, nextOwner) === 0)) {
        owners.push(nextOwner)
        owners.sort(compareConflictOwners)
      }
      conflicts.set(path, owners)
    }
  }

  if (conflicts.size > 0) {
    return {
      ok: false,
      conflicts: [...conflicts.entries()]
        .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
        .map(([path, owners]) => ({ path, owners })),
    }
  }

  return { ok: true, routes: merged }
}
