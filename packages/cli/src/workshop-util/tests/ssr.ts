import { ServerResponse } from 'http'


export const ssr = (ctx:ServerResponse, html:string) => {
  ctx.writeHead(200, { 'Content-Type': 'text/html' })
  return ctx.end(html)
}
