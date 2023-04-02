import { bundler } from './bundler.ts'
import { mimeTypes, Routes } from '$server'
import { PlaitedElement, ssr } from '$plaited'
import { walk } from '../../libs/dev-deps.ts'
import { compress, startCase, toFileUrl } from '../../libs/deps.ts'
import { HomeTemplate } from './home.template.tsx'
import { NavItemTemplate, TestShellTemplate } from './test-shell.template.tsx'
import { TestPageTemplate } from './test.template.tsx'

export const setRoutes = async ({
  dev,
  importMap,
  routes,
  client,
}: {
  dev: boolean
  importMap?: URL
  routes: Routes
  client: string
}) => {
  /** get paths and name for exts */
  const entryPoints = new Set<string>()
  const exts = [
    '.spec.ts',
    'registry.ts',
    '.template.ts',
    'runner.ts',
    '.worker.ts',
  ]
  for await (
    const entry of walk(client, {
      exts,
    })
  ) {
    const { path } = entry
    entryPoints.add(path)
  }

  /** split off ssr templates  */
  const serverEntries: { relative: string; absolute: string }[] = []
  entryPoints.forEach((val) => {
    if (val.endsWith('.template.ts')) {
      serverEntries.push({ relative: val.replace(client, ''), absolute: val })
      entryPoints.delete(val)
    }
  })

  /** bundle entry point from workspace */
  const entries = await bundler({
    dev,
    entryPoints: [...entryPoints],
    importMap,
  })

  /** an array to hold paths to stor sets */
  const clientEntries: string[] = []

  /** create js routes for entries and push entryPoints to clientEntries */
  for (const [path, file] of entries) {
    routes.set(
      path,
      () =>
        new Response(compress(file), {
          headers: {
            'content-type': mimeTypes('js'),
            'content-encoding': 'br',
          },
        }),
    )
    if (exts.some((ext) => path.endsWith(ext.replace('.ts', '.js')))) {
      clientEntries.push(path)
    }
  }

  /** create test files path array */
  const testEntries: { name: string; path: string }[] = []
  await Promise.all(clientEntries.map(async (entry) => {
    if (entry.endsWith('.spec.js')) {
      /**  Create a new URL object */
      const url = new URL(toFileUrl(entry))
      /** Get the pathname and split it using '/' */
      const pathParts = url.pathname.split('/')
      /** Remove the last element (the filename) */
      const testFile = pathParts.pop()
      const name = startCase(testFile?.slice(0, -8))
      /** concat path pars */
      const dir = pathParts.join('/')
      /** push path onto testEntries array */
      testEntries.push({ path: dir, name })
      const registry = clientEntries.find((entry) =>
        entry.startsWith(dir) && entry.endsWith('registry.js')
      )
      const { absolute } = serverEntries.find(({ relative }) =>
        relative.startsWith(dir) &&
        relative.endsWith('template.tsx')
      ) ?? {}

      const body: PlaitedElement[] = []

      if (absolute) {
        const modules = await import(absolute)
        for (const mod in modules) {
          body.push(modules[mod])
        }
      }
      routes.set(dir, () =>
        new Response(
          ssr(
            <TestPageTemplate
              title={name}
              registry={registry}
              body={body}
              tests={entry}
            />,
          ),
          {
            headers: { 'Content-Type': 'text/html' },
          },
        ))
    }
  }))

  /** Set route to get stories */
  routes.set(
    `GET@/tests`,
    () =>
      new Response(
        JSON.stringify(testEntries),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
  )

  routes.set('/', () =>
    new Response(
      ssr(
        <HomeTemplate>
          <TestShellTemplate>
            {testEntries.map(({ path, name }) => (
              <NavItemTemplate name={name} path={path} />
            ))}
          </TestShellTemplate>
        </HomeTemplate>,
      ),
      {
        headers: { 'Content-Type': 'text/html' },
      },
    ))

  return routes
}
