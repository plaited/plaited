import { livereloadTemplate } from '$server'
import { html } from '$plaited'
export const HomeTemplate = (body: string) =>
  html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plaited tests</title>
  <link rel="icon" href="data:," />
  <script type="module" src="/registry.js"></script>
</head>
<body style="margin:0">
  ${body}
  <script type="module" src="/runner.js"></script>
  ${livereloadTemplate}
</body>
</html>
`
