import { z } from 'zod'
import { joinStyles, ssr, type TemplateObject } from '../main.ts'
import { FIXTURE_EVENTS, STORY_FIXTURE } from '../testing/testing.constants.ts'
import type { StoryExport } from '../testing.ts'
import { getPaths } from './get-paths.ts'
import { zip } from './workshop.utils.ts'

/**
 * Module-level cache for dynamic imports to avoid redundant loading.
 * Maps file paths to imported modules.
 */
const importCache = new Map<string, Record<string, StoryExport>>()

/**
 * Cached dynamic import for story files.
 * Reuses previously imported modules to improve performance.
 *
 * @param filePath - Absolute path to the story file
 * @returns The imported module
 */
const cachedImport = async (filePath: string): Promise<Record<string, StoryExport>> => {
  if (!importCache.has(filePath)) {
    importCache.set(filePath, (await import(filePath)) as Record<string, StoryExport>)
  }
  return importCache.get(filePath)!
}

/**
 * Zod schema for validating PlaitedAttributes structure.
 * Based on PlaitedAttributes from create-template.types.ts
 * Uses z.looseObject() to allow additional HTML/ARIA attributes.
 */
const PlaitedAttributesSchema = z
  .looseObject({
    class: z.string().optional(),
    children: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number(), z.any()]))]).optional(),
    'p-target': z.union([z.string(), z.number()]).optional(),
    'p-trigger': z.record(z.string(), z.string()).optional(),
    stylesheets: z.array(z.string()).optional(),
    classNames: z.array(z.string()).optional(),
    trusted: z.boolean().optional(),
    style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  })
  .optional()

const createFixtureLoadScript = ({ entryPath, exportName }: { entryPath: string; exportName: string }) => `\n
import { ${exportName} } from '${entryPath}'

await customElements.whenDefined("${STORY_FIXTURE}")
const fixture = document.querySelector("${STORY_FIXTURE}");
fixture?.trigger({
  type: '${FIXTURE_EVENTS.run}',
  detail:  {play: ${exportName}?.play, timeout: ${exportName}?.params?.timeout}
});
`

const useTemplateInclude = ({ fixture, entryPath }: { fixture: TemplateObject; entryPath: string }): Response => {
  const content = ssr(
    fixture,
    <script
      type='module'
      trusted
      src={entryPath}
    />,
  )
  return zip({
    content,
    contentType: 'text/html;charset=utf-8',
  })
}

const usePage = ({
  fixture,
  entryPath,
  exportName,
  parameters,
}: {
  fixture: TemplateObject
  entryPath: string
  exportName: string
  parameters?: StoryExport['parameters']
}): Response => {
  // Merge default body styles with parameters.styles if provided
  const bodyStyles = ['body { height: 100vh; height: 100dvh; margin: 0; }']
  const additionalStyles = parameters?.styles ? Object.entries(parameters.styles).map(([k, v]) => `${k}: ${v}`) : []

  const content = ssr(
    <html lang='en'>
      <head>
        <title>{exportName}</title>
        <link
          rel='shortcut icon'
          href='#'
        />
      </head>
      <body
        {...joinStyles({
          stylesheets: [...bodyStyles, ...additionalStyles],
        })}
      >
        {fixture}
        <script
          defer
          type='module'
          trusted
        >
          {createFixtureLoadScript({
            exportName,
            entryPath,
          })}
        </script>
      </body>
    </html>,
  )
  return zip({
    content: `<!DOCTYPE html>\n${content}`,
    contentType: 'text/html;charset=utf-8',
  })
}

/**
 * Generates HTML routes for a story export.
 * Creates two routes per story:
 * - Main route: Full HTML page with hot reload
 * - Include route: Just the story fixture HTML fragment
 *
 * @param exportName - Named export from the story file
 * @param filePath - Absolute path to the .stories.tsx file
 * @param cwd - Current working directory
 * @returns Object with static Response objects
 *
 * @internal
 */
export const getHTMLRoutes = async ({
  exportName,
  filePath,
  cwd,
}: {
  exportName: string
  filePath: string
  cwd: string
}): Promise<Record<string, Response>> => {
  // Make path relative to cwd and convert to entry path
  const { route, entryPath } = getPaths({ cwd, filePath, exportName })
  const module = await cachedImport(filePath)
  const storyExport = module[exportName]

  // Extract fixture and parameters from story export
  const { fixture, parameters, args } = storyExport!

  // Validate args if they exist
  if (args !== undefined) {
    try {
      PlaitedAttributesSchema.parse(args)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse = new Response(
          JSON.stringify({
            error: 'Invalid story args',
            details: error.issues,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
        return {
          [route]: errorResponse,
          [`${route}.template`]: errorResponse,
        }
      }
    }
  }

  return {
    [route]: usePage({ fixture, entryPath, exportName, parameters }),
    [`${route}.template`]: useTemplateInclude({ fixture, entryPath }),
  }
}
