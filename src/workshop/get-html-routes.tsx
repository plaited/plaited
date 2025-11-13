import { joinStyles, type TemplateObject } from '../main.js'
import { ssr } from '../main.js'
import { zip } from './zip.js'
import { RUNNER_URL, RELOAD_PAGE } from '../testing/testing.constants.js'
import { getEntryPath } from './get-entry-path.js'
import { kebabCase } from '../utils.js'
import { z } from 'zod'
import type { StoryExport } from '../testing/testing.types.js'

/**
 * Zod schema for validating PlaitedAttributes structure.
 * Based on PlaitedAttributes from create-template.types.ts
 * Uses .passthrough() to allow additional HTML/ARIA attributes.
 */
const PlaitedAttributesSchema = z
  .object({
    class: z.string().optional(),
    children: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number(), z.any()]))]).optional(),
    'p-target': z.union([z.string(), z.number()]).optional(),
    'p-trigger': z.record(z.string()).optional(),
    stylesheets: z.array(z.string()).optional(),
    classNames: z.array(z.string()).optional(),
    trusted: z.boolean().optional(),
    style: z.record(z.union([z.string(), z.number()])).optional(),
  })
  .passthrough()
  .optional()

const getRoutePath = ({ filePath, cwd, exportName }: { filePath: string; cwd: string; exportName: string }): string => {
  // Make path relative to cwd
  const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
  // Replace .stories.tsx extension with .js for bundled output
  return getEntryPath(relativePath, '.stories.tsx').replace(/index\.js$/, kebabCase(exportName))
}

const createReloadClient = () => `
// WebSocket hot reload client
(function() {
  const WS_URL = '${RUNNER_URL}';
  const RELOAD_MESSAGE = '${RELOAD_PAGE}';
  const RETRY_CODES = [1006, 1012, 1013];
  const MAX_RETRIES = 3;

  let socket;
  let retryCount = 0;

  function connect() {
    const wsUrl = location.origin.replace(/^http/, 'ws') + WS_URL;
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      retryCount = 0;
    });

    socket.addEventListener('message', (evt) => {
      if (evt.data === RELOAD_MESSAGE) {
        window.location.reload();
      }
    });

    socket.addEventListener('error', (evt) => {
      console.error('[Plaited] WebSocket error:', evt);
    });

    socket.addEventListener('close', (evt) => {
      if (RETRY_CODES.includes(evt.code) && retryCount < MAX_RETRIES) {
        const delay = Math.min(9999, 1000 * Math.pow(2, retryCount));
        const jitter = Math.floor(Math.random() * delay);
        setTimeout(connect, jitter);
        retryCount++;
      }
    });
  }

  connect();
})();
`

const useInclude = ({ fixture, entryPath }: { fixture: TemplateObject; entryPath: string }): Response => {
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
    <html>
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
          type='module'
          trusted
          src={entryPath}
        />
        <script
          defer
          type='module'
          trusted
        >
          {createReloadClient()}
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
  const route = getRoutePath({ exportName, cwd, filePath })
  const { [exportName]: storyExport } = (await import(filePath)) as Record<string, StoryExport>

  // Extract fixture and parameters from story export
  const { fixture, parameters, args } = storyExport

  // Validate args if they exist
  if (args !== undefined) {
    try {
      PlaitedAttributesSchema.parse(args)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse = new Response(
          JSON.stringify({
            error: 'Invalid story args',
            details: error.errors,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
        return {
          [route]: errorResponse,
          [`${route}.include`]: errorResponse,
        }
      }
    }
  }

  // Make path relative to cwd and convert to entry path
  const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
  const entryPath = getEntryPath(relativePath, '.stories.tsx')

  return {
    [route]: usePage({ fixture, entryPath, exportName, parameters }),
    [`${route}.include`]: useInclude({ fixture, entryPath }),
  }
}
