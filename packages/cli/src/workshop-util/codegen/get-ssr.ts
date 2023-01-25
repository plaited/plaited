import { ServerResponse } from 'http'
import { template } from './templates.js'

export const getSRR = (opt: {
  head?: string,
  body?: string,
} = {}) => (
  ctx:ServerResponse, html:string
) => {
  const tpl = template(html, opt)
  ctx.writeHead(200, { 'Content-Type': 'text/html' })
  ctx.end(tpl)
}
