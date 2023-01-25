import { ServerResponse } from 'http'
import { worksHelmet } from './templates.js'

export const worksSSR = (opt: {
  head?: string,
  body?: string,
} = {}) => (
  ctx:ServerResponse, html:string
) => {
  const tpl = worksHelmet(html, opt)
  ctx.writeHead(200, { 'Content-Type': 'text/html' })
  ctx.end(tpl)
}
