import { html } from '@plaited/island'

export const livereload = html`<script>
const source = new EventSource('/livereload');
const reload = () => location.reload(true);
source.onmessage = reload;
source.onerror = () => (source.onopen = reload);
console.log('[plaited] listening for file changes');
</script>`

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
  ${livereload}
</body>
</html>`
