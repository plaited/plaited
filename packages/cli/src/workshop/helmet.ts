import { html } from '@plaited/island'

export const helmet = (fixture: string, src: string) => html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root">
    ${fixture}
  </div>
  <script src="${src}" type="module"></script>
</body>
</html>`
