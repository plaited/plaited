import { PlaitedElement } from 'plaited'

const liveReloadTemplate =   `const source = new EventSource('/livereload');
const reload = () => location.reload(true);
source.onmessage = reload;
source.onerror = () => (source.onopen = reload);
console.log('[workshop] listening for file changes');`

const metaTemplate = (path: string) => `import meta from '${path}';
meta?.define();`

export const Page: PlaitedElement<{
  id: string,
  story: string,
  reload: boolean
  tokens: string
}> = ({ 
  children,
  id,
  reload,
  story,
  tokens,
}) => (
  <html>
    <head>
      <title>{id}</title>
      <link rel='icon'
        href='data:,'
      />
      <script type='module'
        trusted
      >
        {metaTemplate(story)}
      </script>
      <style>{tokens}</style>
    </head>
    <body>
      {children}
      {reload && <script trusted>{liveReloadTemplate}</script>}
    </body>
  </html>
)
