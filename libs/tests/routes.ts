import { livereloadTemplate, mimeTypes, Routes } from '$server'
import { bundler } from '$bundler'
import { css, html } from '$plaited'
import { CalculatorTemplate } from './workspace/calculator.template.ts'

import { resolve, toFileUrl, walk } from '../deps.ts'

const __dirname = new URL('.', import.meta.url).pathname
export const workspace = resolve(__dirname, 'workspace')
const importMap = toFileUrl(resolve(Deno.cwd(), '.vscode/import-map.json'))

// Get entryPoints for ts files in workspace
const entryPoints: string[] = []
for await (
  const entry of walk(workspace, {
    exts: ['.ts'],
  })
) {
  const { path } = entry
  entryPoints.push(path)
}

// Function to generate routes for entryPoints
export const getRoutes = async () => {
  const [entries] = await bundler({
    dev: true,
    entryPoints,
    importMap,
  })

  const routes: Routes = new Map()

  for (const [path, file] of entries) {
    routes.set(
      path,
      () =>
        new Response(file, {
          headers: {
            'content-type': mimeTypes('js'),
          },
        }),
    )
  }
  return routes
}

export const routes = await getRoutes()

const { styles, classes } = css`
  body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fixture {
    padding: 12px;
    border: 1px solid black;
  }
`
// Set root route test runner
routes.set('/', () =>
  new Response(
    html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>plaited tests</title>
      <link rel="icon" href="data:," />
      <script type="module" src="/calculator.island.js"></script>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <details class="${classes.fixture}" id="island-comms-test" open>
        <summary>Island & Comms test</summary>
        ${CalculatorTemplate}
      </details>
      <details class="${classes.fixture}" id="dynamic-island-comms-test" open>
        <summary>Dynamic Island & Comms test</summary>
      </details>
      <details class="${classes.fixture}" id="slot-test" open>
        <summary>Slot test</summary>
      </details>
      <details class="${classes.fixture}" id="template-observer-test" open>
        <summary>Template observer test</summary>
      </details>
      <details class="${classes.fixture}" id="shadow-observer-test" open>
        <summary>Shadow observer test</summary>
      </details>
      <script type="module" src="/test-runner.js"></script>
      ${livereloadTemplate}
    </body>
    </html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  ))
