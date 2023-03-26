import { livereloadTemplate } from '$server'
import { html } from '$plaited'

export const TestPageTemplate = ({
  title,
  registry,
  body,
  tests,
}: {
  title: string
  registry?: string
  body?: string
  tests: string
}) =>
  html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" href="data:," />
  ${registry && html`<script type="module" src="${registry}"></script>`}
</head>
<body>
<h1><a href="" target="_blank">${title}</a></h1>
  <div id="root">
    ${body}
  </div>
  <script type="module" type="module" async>
    await import('${tests}');
    await import('/runner.js');
  </script>
  ${livereloadTemplate}
</body>
</html>
`
