import { livereloadTemplate } from '../livereload-template.ts'

export const ssr = (html:string) => {
  return new Response(html + livereloadTemplate, {
    headers: { 'Content-Type': 'text/html' },
  })
}
