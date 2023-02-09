// import { html } from '../island/mod.ts'
import { livereloadTemplate } from './livereload-template.ts'

export const page = ({ head, body, dev }: {
  head: string
  body: string
  dev: boolean
}) =>
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${head}
</head>
<body>
  ${body}
  ${dev && livereloadTemplate}
</body>
</html>`
