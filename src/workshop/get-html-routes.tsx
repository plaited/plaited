import { joinStyles, type FunctionTemplate, type BehavioralTemplate, type Attrs } from '../main.js'
import { ssr } from '../main.js'
import { zip } from './zip.js'
import { RELOAD_URL, RELOAD_PAGE } from '../testing/testing.constants.js'
import { getEntryPath } from './get-entry-path.js'
import { kebabCase } from '../utils.js'
import { z } from 'zod'

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

/**
 * Validates request body as PlaitedAttributes.
 * Returns validated attrs or error response.
 *
 * @param req - Request object to validate
 * @returns Object with either validated attrs or error Response
 *
 * @internal
 */
const validateRequestAttrs = async (req: Request): Promise<{ attrs: Attrs } | { error: Response }> => {
  try {
    const rawBody = await req.json()
    const validated = PlaitedAttributesSchema.parse(rawBody)
    return { attrs: validated || {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Invalid attrs structure - return error response
      return {
        error: new Response(
          JSON.stringify({
            error: 'Invalid request body',
            details: error.errors,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      }
    }
    // JSON parse error or no body - use empty object
    return { attrs: {} }
  }
}

const getRoutePath = ({ filePath, cwd, exportName }: { filePath: string; cwd: string; exportName: string }): string => {
  // Make path relative to cwd
  const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
  // Replace .tsx extension with .js for bundled output
  return getEntryPath(relativePath, '.tsx').replace(/index\.js$/, kebabCase(exportName))
}

const createReloadClient = () => `
// WebSocket hot reload client
(function() {
  const RUNNER_URL = '${RELOAD_URL}';
  const RELOAD_MESSAGE = '${RELOAD_PAGE}';
  const RETRY_CODES = [1006, 1012, 1013];
  const MAX_RETRIES = 3;

  let socket;
  let retryCount = 0;

  function connect() {
    const wsUrl = location.origin.replace(/^http/, 'ws') + RUNNER_URL;
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

const useInclude = ({
  template,
  entryPath,
}: {
  template: FunctionTemplate | BehavioralTemplate
  entryPath: string
}) => {
  return async (req: Request) => {
    const result = await validateRequestAttrs(req)

    // Early return if validation error
    if ('error' in result) {
      return result.error
    }

    // Happy path - render with validated attrs
    const content = ssr(
      template(result.attrs),
      <script
        type='module'
        trusted
        src={entryPath}
      />,
    )
    return zip({
      content,
      contentType: 'text/html;charset=utf-8',
      headers: req.headers,
    })
  }
}

const usePage = ({
  template,
  entryPath,
  exportName,
}: {
  template: FunctionTemplate | BehavioralTemplate
  entryPath: string
  exportName: string
}) => {
  return async (req: Request) => {
    const result = await validateRequestAttrs(req)

    // Early return if validation error
    if ('error' in result) {
      return result.error
    }

    // Happy path - render with validated attrs
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
            stylesheets: ['body { height: 100vh; height: 100dvh; margin: 0; }'],
          })}
        >
          {template(result.attrs)}
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
      headers: req.headers,
    })
  }
}

export const getHTMLRoutes = async ({
  exportName,
  filePath,
  cwd,
}: {
  exportName: string
  filePath: string
  cwd: string
}) => {
  const route = getRoutePath({ exportName, cwd, filePath })
  const { [exportName]: template } = await import(filePath)
  // Make path relative to cwd and convert to entry path
  const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
  const entryPath = getEntryPath(relativePath, '.tsx')
  return {
    [route]: usePage({ template, entryPath, exportName }),
    [`${route}.include`]: useInclude({ template, entryPath }),
  }
}
