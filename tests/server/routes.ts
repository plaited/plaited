//@ts-ignore: d
window.HTMLElement = class {}

import { livereloadTemplate, mimeTypes, Routes } from '$server'
import { bundler } from './bundler.ts'
import { css, html } from '$plaited'
import { toFileUrl } from '../../libs/deps.ts'

import { CalculatorIsland } from '../client/calculator/calculator.island.ts'

console.log(CalculatorIsland)

export const client = `${Deno.cwd()}/tests/client`
const importMap = toFileUrl(`${Deno.cwd()}/.vscode/import-map.json`)

// entryPoints for ts files in client
const entryPoints: string[] = [
  `${client}/test-runner.ts`,
  `${client}/plaited.spec.ts`,
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
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <details class="${classes.fixture}" id="template-observer-test" open>
        <summary class="${classes.summary}">Render test</summary>
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
