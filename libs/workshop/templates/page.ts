import { html } from '../../island/mod.ts'
import { PageFunc } from '../types.ts'
export const defaultPage: PageFunc = ({ head, body }) =>
  html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${head}
</head>
<body>
  ${body}
</body>
</html>`
