import { html } from '@plaited/template'
import { livereloadTemplate } from '../dev-server-util/index.js'

export const template = (main: string, opt: {
  head?: string,
  body?: string,
} = {}) => html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${opt?.head}
</head>
<body>
  ${main}
  ${opt?.body}
  ${livereloadTemplate}
</body>
</html>`
