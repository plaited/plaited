import type { SnapshotContextFactoryCreator } from './factories.types.ts'

/**
 * Placeholder snapshot-context factory.
 *
 * @remarks
 * Runtime SQLite support has been removed from `create-agent`. Snapshot
 * persistence or projection should now be layered elsewhere.
 *
 * @public
 */
export const createSnapshotContextFactory: SnapshotContextFactoryCreator = () => () => ({})
