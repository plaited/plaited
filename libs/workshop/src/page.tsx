import { PlaitedElement } from 'plaited'

const liveReloadTemplate =   `const source = new EventSource('/livereload');
const reload = () => location.reload(true);
source.onmessage = reload;
source.onerror = () => (source.onopen = reload);
console.log('[workshop] listening for file changes');`

const metaTemplate = (storyPath: string) => `import meta from '${storyPath}';
meta?.define();`

export const Page: PlaitedElement<{
  id: string,
  clientPath: string,
  reload: boolean
}> = ({ 
  children,
  id,
  reload,
  clientPath,
  stylesheet,
}) => (
  <html>
    <head stylesheet={stylesheet}>
      <title>{id}</title>
      <link rel='icon'
        href='data:,'
      />
      <script type='module'
        trusted
      >
        {metaTemplate(clientPath)}
      </script>
    </head>
    <body>
      {children}
      {reload && <script trusted>{liveReloadTemplate}</script>}
    </body>
  </html>
)
