import { html, template } from '../../islandly/mod.ts'
import { livereloadTemplate } from '../../server/livereload-template.ts'

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
  <link rel="icon" href="data:,">
  <title>${title}</title>
  ${head}
</head>
<body>
  ${body}
  ${dev && livereloadTemplate}
</body>
</html>`
)
