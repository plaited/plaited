import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

type WritableSnapshotEntry = {
  exists: boolean
  bytes?: Uint8Array
}

type WritableSnapshot = Map<string, WritableSnapshotEntry>

const normalizePath = (value: string): string => value.replaceAll('\\', '/')

const resolveWritableRoot = ({ root, workspaceRoot }: { root: string; workspaceRoot: string }): string =>
  isAbsolute(root) ? root : resolve(workspaceRoot, root)

const scanRootFiles = async ({
  absoluteRoot,
  workspaceRoot,
}: {
  absoluteRoot: string
  workspaceRoot: string
}): Promise<string[]> => {
  const file = Bun.file(absoluteRoot)
  if (await file.exists()) {
    const relativePath = normalizePath(relative(workspaceRoot, absoluteRoot))
    return relativePath ? [relativePath] : []
  }

  const exists = await Bun.$`test -d ${absoluteRoot}`.quiet().nothrow()
  if (exists.exitCode !== 0) {
    return []
  }

  const relativeRoot = normalizePath(relative(workspaceRoot, absoluteRoot))
  const glob = new Bun.Glob('**/*')
  const files: string[] = []
  for await (const path of glob.scan({ cwd: absoluteRoot, onlyFiles: true })) {
    files.push(normalizePath(join(relativeRoot, path)))
  }
  return files.sort()
}

const readSnapshotEntry = async ({
  relativePath,
  workspaceRoot,
}: {
  relativePath: string
  workspaceRoot: string
}): Promise<WritableSnapshotEntry> => {
  const absolutePath = resolve(workspaceRoot, relativePath)
  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    return { exists: false }
  }

  return {
    exists: true,
    bytes: await file.bytes(),
  }
}

/**
 * Captures the current file contents under the declared writable roots.
 *
 * @public
 */
export const captureWritableSnapshot = async ({
  writableRoots,
  workspaceRoot,
}: {
  writableRoots: string[]
  workspaceRoot: string
}): Promise<WritableSnapshot> => {
  const snapshot: WritableSnapshot = new Map()

  for (const root of writableRoots) {
    const absoluteRoot = resolveWritableRoot({
      root,
      workspaceRoot,
    })
    const files = await scanRootFiles({
      absoluteRoot,
      workspaceRoot,
    })

    for (const relativePath of files) {
      snapshot.set(
        relativePath,
        await readSnapshotEntry({
          relativePath,
          workspaceRoot,
        }),
      )
    }
  }

  return snapshot
}

/** @public */
export const writeWritableSnapshotFile = async (path: string, snapshot: WritableSnapshot): Promise<void> => {
  const serialized = Object.fromEntries(
    [...snapshot.entries()].map(([relativePath, entry]) => [
      relativePath,
      {
        exists: entry.exists,
        bytes: entry.bytes ? Buffer.from(entry.bytes).toString('base64') : undefined,
      },
    ]),
  )

  await Bun.write(path, JSON.stringify(serialized, null, 2))
}

/** @public */
export const readWritableSnapshotFile = async (path: string): Promise<WritableSnapshot> => {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new Error(`Missing writable snapshot: ${path}`)
  }

  const json = (await file.json()) as Record<string, { exists: boolean; bytes?: string }>
  const snapshot: WritableSnapshot = new Map()
  for (const [relativePath, entry] of Object.entries(json)) {
    snapshot.set(relativePath, {
      exists: entry.exists,
      bytes: entry.bytes ? Uint8Array.from(Buffer.from(entry.bytes, 'base64')) : undefined,
    })
  }
  return snapshot
}

/**
 * Computes changed paths by comparing the current writable roots against a
 * prior snapshot.
 *
 * @public
 */
export const diffWritableSnapshot = async ({
  snapshot,
  writableRoots,
  workspaceRoot,
}: {
  snapshot: WritableSnapshot
  writableRoots: string[]
  workspaceRoot: string
}): Promise<string[]> => {
  const currentPaths = new Set<string>(snapshot.keys())

  for (const root of writableRoots) {
    const absoluteRoot = resolveWritableRoot({
      root,
      workspaceRoot,
    })
    const files = await scanRootFiles({
      absoluteRoot,
      workspaceRoot,
    })
    for (const relativePath of files) {
      currentPaths.add(relativePath)
    }
  }

  const changedPaths: string[] = []
  for (const relativePath of [...currentPaths].sort()) {
    const previous = snapshot.get(relativePath) ?? { exists: false }
    const current = await readSnapshotEntry({
      relativePath,
      workspaceRoot,
    })

    if (previous.exists !== current.exists) {
      changedPaths.push(relativePath)
      continue
    }

    if (!previous.exists || !current.exists) {
      continue
    }

    const previousBytes = previous.bytes ?? new Uint8Array()
    const currentBytes = current.bytes ?? new Uint8Array()
    if (previousBytes.length !== currentBytes.length) {
      changedPaths.push(relativePath)
      continue
    }
    if (!previousBytes.every((value, index) => value === currentBytes[index])) {
      changedPaths.push(relativePath)
    }
  }

  return changedPaths
}

/**
 * Restores changed paths back to the prior writable snapshot.
 *
 * @public
 */
export const revertWritableSnapshot = async ({
  changedPaths,
  snapshot,
  workspaceRoot,
}: {
  changedPaths: string[]
  snapshot: WritableSnapshot
  workspaceRoot: string
}): Promise<void> => {
  for (const relativePath of changedPaths) {
    const absolutePath = resolve(workspaceRoot, relativePath)
    const previous = snapshot.get(relativePath)

    if (!previous?.exists) {
      await Bun.$`rm -f ${absolutePath}`.quiet().nothrow()
      continue
    }

    await Bun.$`mkdir -p ${dirname(absolutePath)}`.quiet()
    await Bun.write(absolutePath, previous.bytes ?? new Uint8Array())
  }
}
