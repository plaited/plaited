import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Glob } from 'bun'
import { UpdateModuleModuleSchema } from '../../agent.ts'
import {
  type ModuleModuleCatalogEntry,
  ModuleModuleCatalogEntrySchema,
  type ModuleSourceClass,
} from './module-discovery-module.schemas.ts'

const defaultPatterns = ['**/*.module-module.ts', '**/*.module-module.tsx', '**/*.module-module.js']

const inferSourceClass = (path: string): ModuleSourceClass => {
  if (path.includes('/generated/') || path.startsWith('generated/')) return 'generated'
  if (path.includes('/deployment/') || path.startsWith('deployment/')) return 'deployment'
  return 'default'
}

const findNearestPackageName = async (rootDir: string, modulePath: string): Promise<string | undefined> => {
  let currentDir = dirname(resolve(rootDir, modulePath))
  const resolvedRoot = resolve(rootDir)

  while (currentDir.startsWith(resolvedRoot)) {
    const packagePath = join(currentDir, 'package.json')
    const packageFile = Bun.file(packagePath)
    if (await packageFile.exists()) {
      const parsed = (await packageFile.json()) as { name?: unknown }
      if (typeof parsed.name === 'string' && parsed.name.length > 0) {
        return parsed.name
      }
    }

    if (currentDir === resolvedRoot) break
    currentDir = dirname(currentDir)
  }

  return undefined
}

/**
 * Discovers module modules under a root directory and validates their export contract.
 *
 * @param options - Discovery options.
 * @returns Valid catalog entries plus validation errors for rejected candidates.
 *
 * @public
 */
export const discoverModuleModules = async ({
  rootDir,
  patterns = defaultPatterns,
}: {
  rootDir: string
  patterns?: string[]
}): Promise<{
  catalog: ModuleModuleCatalogEntry[]
  errors: Array<{ path: string; message: string }>
}> => {
  const paths = new Set<string>()

  for (const pattern of patterns) {
    const glob = new Glob(pattern)
    for await (const path of glob.scan({ cwd: rootDir, absolute: false })) {
      paths.add(path)
    }
  }

  const catalog: ModuleModuleCatalogEntry[] = []
  const errors: Array<{ path: string; message: string }> = []

  for (const path of [...paths].sort()) {
    try {
      const moduleUrl = pathToFileURL(resolve(rootDir, path)).href
      const imported = await import(moduleUrl)
      const parsed = UpdateModuleModuleSchema.parse(imported)
      catalog.push(
        ModuleModuleCatalogEntrySchema.parse({
          id: relative(rootDir, resolve(rootDir, path)).replace(/\.[^.]+$/, ''),
          path,
          packageName: await findNearestPackageName(rootDir, path),
          sourceClass: inferSourceClass(path),
          moduleCount: parsed.default.length,
        }),
      )
    } catch (error) {
      errors.push({
        path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { catalog, errors }
}
