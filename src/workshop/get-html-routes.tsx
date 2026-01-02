import { z } from 'zod'
import { joinStyles, ssr, type TemplateObject } from '../main.ts'
import {
  ORCHESTRATOR_EVENTS,
  STORY_FIXTURE,
  STORY_HEADER,
  STORY_MASK,
  STORY_ORCHESTRATOR,
} from '../testing/testing.constants.ts'
import type { StoryExport } from '../testing.ts'
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

const PLAITED_STORY_ELEMENTS = `["${STORY_FIXTURE}", "${STORY_ORCHESTRATOR}", "${STORY_HEADER}", "${STORY_MASK}"]`

const createFixtureLoadScript = ({ entryPath, exportName }: { entryPath: string; exportName: string }) => `\n
import { ${exportName} } from '${entryPath}'
await Promise.all(${PLAITED_STORY_ELEMENTS}.map(async (tag) => await customElements.whenDefined(tag)))
const orchestrator = document.querySelector("${STORY_ORCHESTRATOR}")
orchestrator?.trigger({
  type: '${ORCHESTRATOR_EVENTS.init}',
  detail:  {play: ${exportName}?.play, timeout: ${exportName}?.params?.timeout}
});
`

const usePage = ({
  fixture,
  entryPath,
  exportName,
  parameters,
  colorScheme,
}: {
  fixture: TemplateObject
  entryPath: string
  exportName: string
  parameters?: StoryExport['parameters']
  colorScheme: 'light' | 'dark'
}): Response => {
  // Merge default body styles with parameters.styles if provided
  const bodyStyles = ['body { height: 100vh; height: 100dvh; margin: 0; }']
  const additionalStyles = parameters?.styles ? Object.entries(parameters.styles).map(([k, v]) => `${k}: ${v}`) : []

  const content = ssr(
    <html
      lang='en'
      style={{ 'color-scheme': colorScheme }}
    >
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
 * Generates HTML route for a story export.
 * Creates a full HTML page with the story fixture.
 *
 * @param exportName - Named export from the story file
 * @param filePath - Absolute path to the .stories.tsx file
 * @param entryPath - Path to the story's JS entry file
 * @param colorScheme - Color scheme for the page ('light' or 'dark')
 * @returns Static Response object for the route
 *
 * @internal
 */
export const getHTMLRoute = async ({
  exportName,
  filePath,
  entryPath,
  colorScheme,
}: {
  exportName: string
  filePath: string
  entryPath: string
  colorScheme: 'light' | 'dark'
}): Promise<Response> => {
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
        return new Response(
          JSON.stringify({
            error: 'Invalid story args',
            details: error.issues,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
    }
  }

  return usePage({ fixture, entryPath, exportName, parameters, colorScheme })
}
