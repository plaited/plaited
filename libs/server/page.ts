import { html } from '../islandly/mod.ts'
import { livereloadTemplate } from './livereload-template.ts'

export const page = ({ head, body, dev, title }: {
  head: string
  body: string
  dev: boolean
  title: string
}) =>
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
