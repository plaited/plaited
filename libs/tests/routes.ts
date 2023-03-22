import { livereloadTemplate, mimeTypes, Routes } from '$server'
import { bundler } from './bundler.ts'
import { css, html } from '$plaited'
import { CalculatorTemplate } from './workspace/calculator.template.ts'
import { ShadowTemplate } from './workspace/shadow.template.ts'
import { resolve, toFileUrl } from '../deps.ts'

const __dirname = new URL('.', import.meta.url).pathname
export const workspace = resolve(__dirname, 'workspace')
const importMap = toFileUrl(resolve(Deno.cwd(), '.vscode/import-map.json'))

// entryPoints for ts files in workspace
const entryPoints: string[] = [
  `${workspace}/register.ts`,
  `${workspace}/test-runner.ts`,
  `${workspace}/calculator.worker.ts`,
  `${workspace}/plaited.spec.ts`,
]

// Function to generate routes for entryPoints
export const getRoutes = async () => {
  const routes: Routes = new Map()
  try {
    const entries = await bundler({
      dev: true,
      entryPoints,
      importMap,
    })
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
  } catch (e) {
    console.error(e)
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
  .summary {
    color: rebeccapurple;
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
      <script type="module" src="/register.js"></script>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <details class="${classes.fixture}" id="island-worker-comms-test" open>
        <summary class="${classes.summary}">Island-Worker Comms test</summary>
        ${CalculatorTemplate}
      </details>
      <details class="${classes.fixture}" id="dynamic-island-comms-test" open>
        <summary class="${classes.summary}">Dynamic Island & Comms test</summary>
      </details>
      <details class="${classes.fixture}" id="slot-test" open>
        <summary class="${classes.summary}">Slot test</summary>
      </details>
      <details class="${classes.fixture}" id="template-observer-test" open>
        <summary class="${classes.summary}">Template observer test</summary>
      </details>
      <details class="${classes.fixture}" id="shadow-observer-test" open>
        <summary class="${classes.summary}">Shadow observer test</summary>
        ${ShadowTemplate}
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
