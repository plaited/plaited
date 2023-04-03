import { livereloadTemplate } from '$server'
import { PlaitedElement } from '$plaited'

export const TestPageTemplate: PlaitedElement<{
  title: string
  registry?: string
  tests: string
}> = ({
  title,
  registry,
  children,
  tests,
}) => {
  return (
    <html lang='en'>
      <head>
        <meta charset='UTF-8' />
        <meta http-equiv='X-UA-Compatible' content='IE=edge' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <title>{title}</title>
        <link rel='icon' href='data:,' />
        {registry && <script type='module' src={registry} trusted></script>}
      </head>
      <body trusted>
        <h1>
          <a href='' target='_blank'>{title}</a>
        </h1>
        <div id='root'>
          {children}
        </div>
        <script type='module' async trusted>
          await import('{tests}'); await import('/runner.js');
        </script>
        {livereloadTemplate}
      </body>
    </html>
  )
}
