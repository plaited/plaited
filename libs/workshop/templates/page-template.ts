import { html, template } from '../../islandly/mod.ts'

export const livereloadTemplate = html`<script type="text/javascript">
const source = new EventSource('/livereload');
const reload = () => location.reload(true);
source.onmessage = reload;
source.onerror = () => (source.onopen = reload);
console.log('[plaited] listening for file changes');
</script>`

export const PageTemplate = template<{
  head: string
  body: string
  dev: boolean
  title: string
}>(({ head, body, dev, title }) =>
  html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${head}
</head>
<body>
  ${body}
  ${dev && livereloadTemplate}
</body>
</html>`
)
