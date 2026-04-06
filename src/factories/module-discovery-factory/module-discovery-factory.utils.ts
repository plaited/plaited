import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Glob } from 'bun'
import { UpdateFactoryModuleSchema } from '../../agent.ts'
import {
  type FactoryModuleCatalogEntry,
  FactoryModuleCatalogEntrySchema,
  type ModuleSourceClass,
} from './module-discovery-factory.schemas.ts'

const defaultPatterns = ['**/*.factory-module.ts', '**/*.factory-module.tsx', '**/*.factory-module.js']

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
 * Discovers factory modules under a root directory and validates their export contract.
 *
 * @param options - Discovery options.
 * @returns Valid catalog entries plus validation errors for rejected candidates.
 *
 * @public
 */
export const discoverFactoryModules = async ({
  rootDir,
  patterns = defaultPatterns,
}: {
  rootDir: string
  patterns?: string[]
}): Promise<{
  catalog: FactoryModuleCatalogEntry[]
  errors: Array<{ path: string; message: string }>
}> => {
  const paths = new Set<string>()

  for (const pattern of patterns) {
    const glob = new Glob(pattern)
    for await (const path of glob.scan({ cwd: rootDir, absolute: false })) {
      paths.add(path)
    }
  }

  const catalog: FactoryModuleCatalogEntry[] = []
  const errors: Array<{ path: string; message: string }> = []

  for (const path of [...paths].sort()) {
    try {
      const moduleUrl = pathToFileURL(resolve(rootDir, path)).href
      const imported = await import(moduleUrl)
      const parsed = UpdateFactoryModuleSchema.parse(imported)
      catalog.push(
        FactoryModuleCatalogEntrySchema.parse({
          id: relative(rootDir, resolve(rootDir, path)).replace(/\.[^.]+$/, ''),
          path,
          packageName: await findNearestPackageName(rootDir, path),
          sourceClass: inferSourceClass(path),
          factoryCount: parsed.default.length,
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
