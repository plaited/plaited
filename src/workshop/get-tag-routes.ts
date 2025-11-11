import type { TemplateExport } from './workshop.types.js'
import { getEntryPath } from './get-entry-path.js'
import type { BehavioralTemplate } from '../main.js'

/**
 * Generates routes that map custom element tags to their bundled JavaScript files.
 * Each BehavioralTemplate's tag becomes a route that serves its bundled entry file.
 *
 * @param templates - Array of BehavioralTemplate metadata discovered from files
 * @param entryRoutes - Existing bundled entry routes from getEntryRoutes()
 * @returns Record mapping custom element tags to Response objects
 *
 * @example
 * ```ts
 * const templates = await discoverTemplateMetadata('/src/stories')
 * const entryRoutes = await getEntryRoutes(templates)
 * const tagRoutes = await getTagRoutes(templates, entryRoutes)
 * // Returns: { '/tic-tac-toe-board': Response, '/toggle-input': Response }
 * ```
 *
 * @internal
 */
export const getTagRoutes = async (
  templates: TemplateExport[],
  entryRoutes: Record<string, Response>,
  cwd: string,
): Promise<Record<string, Response>> => {
  const tagRoutes: Record<string, Response> = {}

  for (const { exportName, filePath } of templates) {
    try {
      // Dynamically import to access the BehavioralTemplate object
      const module = await import(filePath)
      const template = module[exportName] as BehavioralTemplate

      if (!template || !template.tag) {
        console.warn(`⚠️  Skipping ${exportName} from ${filePath}: missing tag property`)
        continue
      }

      // Calculate the entry path this template would have
      const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
      const entryPath = getEntryPath(relativePath, '.tsx')

      // Map tag to existing bundled Response
      if (entryRoutes[entryPath]) {
        tagRoutes[`/${template.tag}`] = entryRoutes[entryPath].clone()
      } else {
        console.warn(`⚠️  Entry route not found for ${template.tag}: ${entryPath}`)
      }
    } catch (error) {
      console.error(`❌ Error loading template ${exportName} from ${filePath}:`, error)
    }
  }

  return tagRoutes
}
