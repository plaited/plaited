import { html, element } from '@plaited/template'
import { ServerResponse, IncomingMessage } from 'http'
import { livereloadTemplate } from '../../../server-util/index.js'
import { registry } from './constants.js'

export const helmet = (main: string, opt: {
  insertHead?: string,
  insertBody?: string,
} = {}) => html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="/${registry}"></script>
  ${opt?.insertHead}
</head>
<body>
  ${main}
  ${opt?.insertBody}
  ${livereloadTemplate}
</body>
</html>`


export const ssr = (html:string, fixture: `${string}-${string}`, opts: { insertHead?: string, insertBody?: string}) => {
  const main = element({ tag: fixture, template: html })
  return {
    page: (req: IncomingMessage, ctx:ServerResponse) => {
      ctx.writeHead(200, { 'Content-Type': 'text/html' })
      ctx.end(helmet(main, opts))
    },
    include: (req: IncomingMessage, ctx:ServerResponse) => {
      ctx.writeHead(200, { 'Content-Type': 'text/html' })
      ctx.end(main)
    },
  }
}

