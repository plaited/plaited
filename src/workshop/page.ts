import {  html } from '../template.ts'
import { livereloadTemplate } from '../server.ts'
import { PageFunc } from './types.ts'

export const page: PageFunc = (story) =>
  html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="/.registry/fixture.js"></script>
</head>
<body>
  ${story}
  ${livereloadTemplate}
</body>
</html>`