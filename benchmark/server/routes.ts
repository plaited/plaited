import { livereloadTemplate, mimeTypes, Routes } from '$server'
import { html } from '$plaited'

import { ShellTemplate } from './shell.template.ts'
import { bundler } from './bundler.ts'
import { resolve, toFileUrl } from '../../libs/deps.ts'

const __dirname = new URL('.', import.meta.url).pathname
export const client = resolve(__dirname, 'client')
const importMap = toFileUrl(resolve(Deno.cwd(), '.vscode/import-map.json'))

// Function to generate routes for entryPoints
export const getRoutes = async () => {
  const routes: Routes = new Map()
  try {
    const entries = await bundler({
      dev: true,
      entryPoints: [`${client}/register.ts`],
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

routes.set('/', () =>
  new Response(
    html`
<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Plaited</title>
      <link href="/css/currentStyle.css" rel="stylesheet" preload />
      <link rel="icon" href="data:," />
      <script type="module" src="/register.js"></script>
    </head>
    <body>
      ${ShellTemplate}
      ${livereloadTemplate}
    </body>
  </html>
`,
    { headers: { 'Content-Type': 'text/html' } },
  ))
