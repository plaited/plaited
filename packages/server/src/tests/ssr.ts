import { ServerResponse } from 'http'
import { livereloadTemplate } from '../index.js'

export const ssr = (ctx:ServerResponse, html:string) => {
  ctx.writeHead(200, { 'Content-Type': 'text/html' })
  return ctx.end(html + livereloadTemplate)
}
