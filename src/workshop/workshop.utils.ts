import { Glob } from 'bun'

export async function globFiles(cwd: string): Promise<string[]> {
  const glob = new Glob('**/*.{tsx,ts}')
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

export const transpiler = new Bun.Transpiler({
  loader: 'tsx',
  tsconfig: JSON.stringify({
    compilerOptions: {
      jsx: 'react-jsx',
      jsxFactory: 'h',
      jsxFragmentFactory: 'Fragment',
      jsxImportSource: 'plaited',
    },
  }),
})

export const LIVE_RELOAD_PATHNAME = `/reload`

export const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

export const getLiveReloadScript = (port: number) => `
if (typeof(EventSource) !== "undefined") {
   console.log("EventSource API is supported. Connecting to SSE...");
   const eventSource = new EventSource("http://localhost:${port}${LIVE_RELOAD_PATHNAME}");

   eventSource.onopen = function(event) {
       console.log("SSE Connection Opened:", event);
   };

   eventSource.onmessage = function(event) {
       console.log("SSE Message Received:", event.data);
   };

   eventSource.addEventListener('reload', function(event) {
       console.log("SSE 'reload' Event Received. Data:", event.data);
       console.log("Reloading page in a moment...");
       // Reload the page after a short delay
       setTimeout(() => {
           window.location.reload();
       }, 750);
   });

   eventSource.onerror = function(event) {
       console.error("SSE Error Occurred:", event);
       if (eventSource.readyState === EventSource.CLOSED) {
           console.warn("SSE Connection was closed.");
       } else if (eventSource.readyState === EventSource.CONNECTING) {
           console.warn("SSE Connection is trying to reconnect.");
       }
   };

} else {
   console.error("Sorry, your browser does not support server-sent events (EventSource API).");
}
`
