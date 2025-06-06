import path from 'node:path'
import { type StoryObj } from '../testing/assert.types.js'
import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'
import { PLAY_EVENT, PLAITED_FIXTURE } from '../testing/assert.constants'
import { LIVE_RELOAD_PATHNAME, cacheBustHeaders } from './workshop.utils.js'

export type Createstpage = {
  story: StoryObj
  route: string
  responses: Map<string, Response>
  filePath: string
  exportName: string
  port: number
}

export const getLiveReloadScript = ({
  port,
  route,
  filePath,
  entryPath,
  exportName,
}: {
  port: number
  route: string
  filePath: string
  entryPath: string
  exportName: string
}) => `
const eventSource = new EventSource("http://localhost:${port}${LIVE_RELOAD_PATHNAME}");

eventSource.addEventListener('open', async (event) =>{
  console.log("SSE Connection Opened:", event);
  const { ${exportName} } = await import('${entryPath}');
  await customElements.whenDefined("${PLAITED_FIXTURE}")
  const fixture = document.querySelector("${PLAITED_FIXTURE}");
  fixture.trigger({
    type: '${PLAY_EVENT}',
    detail: {
      route: "${route}",
      filePath: "${filePath}",
      entryPath: "${entryPath}",
      exportName: "${exportName}",
      story: ${exportName}
    }
  });
});

eventSource.addEventListener('reload', (event) => {
    console.log("SSE 'reload' Event Received. Data:", { reloads: event.data });
    console.log("Reloading page in a moment...");
    // Reload the page after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 750);
});

eventSource.addEventListener('error', (event) => {
    console.error("SSE Error Occurred:", event);
    if (eventSource.readyState === EventSource.CLOSED) {
        console.warn("SSE Connection was closed.");
    } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn("SSE Connection is trying to reconnect.");
    }
})
`

export const createTestPage = ({ story, route, responses, filePath, exportName, port }: Createstpage) => {
  const entryPath = filePath.replace(/\.tsx?$/, '.js')
  const args = story?.args ?? {}
  const styles = story?.parameters?.styles ?? {}
  const headers = story?.parameters?.headers?.(process.env) ?? new Headers()
  const tpl = story?.template
  const page = ssr(
    <html>
      <head>
        <title>Story:{path.basename(route)}</title>
        <link
          rel='shortcut icon'
          href='#'
        />
      </head>
      <body>
        <PlaitedFixture
          children={tpl?.(args)}
          {...styles}
        />
        <script
          trusted
          type='module'
        >
          {getLiveReloadScript({ port, exportName, filePath, entryPath, route })}
        </script>
      </body>
    </html>,
  )
  responses.set(
    route,
    new Response(`<!DOCTYPE html>\n${page}`, {
      headers: {
        ...cacheBustHeaders,
        ...headers,
      },
    }),
  )
}
