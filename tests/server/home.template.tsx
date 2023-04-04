import { livereloadTemplate } from '$server'
import { PlaitedElement } from '$plaited'
export const HomeTemplate: PlaitedElement = ({ children }) => (
  <html lang='en'>
    <head>
      <meta charset='UTF-8' />
      <meta http-equiv='X-UA-Compatible' content='IE=edge' />
      <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      <title>Plaited tests</title>
      <link rel='icon' href='data:,' />
      <script type='module' src='/registry.js' trusted></script>
    </head>
    <body style={{ margin: '0' }} trusted>
      {children}
      <script type='module' src='/runner.js' trusted></script>
      {livereloadTemplate}
    </body>
  </html>
)