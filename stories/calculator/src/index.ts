import { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import { server, livereloadTemplate } from '@plaited/server'
import { html } from '@plaited/template'
import { fileURLToPath } from 'url'
import { keyPad, valueDisplay } from './islands/templates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const ssr = (ctx:ServerResponse, html:string) => {
  ctx.writeHead(200, { 'Content-Type': 'text/html' })
  return ctx.end(html)
}

export const template = html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  ${valueDisplay}
  ${keyPad}
  <script type="module" src="/registry.js"></script>
  ${livereloadTemplate}
</body>
</html>`

const routes = {
  ['/']: (req: IncomingMessage, ctx: ServerResponse) => ssr(ctx, template),
}

server({
  root: path.resolve(__dirname, '../public'),
  routes,
})
