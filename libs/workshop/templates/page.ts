import { html } from '../../island/mod.ts'
import { livereloadTemplate } from '../../server/mod.ts'
import { PageFunc } from '../types.ts'

export const defaultPage: PageFunc = ({ story, registries, chatui }) =>
  html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${
    registries.map((path) => {
      return `<script type="module" src="/.registry/${path}"></script>`
    }).join('\n')
  }
</head>
<body>
  ${story}
  ${chatui}
  ${livereloadTemplate}
</body>
</html>`
