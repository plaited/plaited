import { sse } from './sse-handler.js'
import { Database } from 'bun:sqlite'
import { generateDot } from '../generate-dot.js'
import { dotToSVG } from '../dot-to-svg.js'
import { formatSVG } from '../format-svg.js'
import { useBundle, useSSR, getHandlers } from '../../build-utils/index.js'
import { Page } from '../page.js'

const registry = 'use_bundle'
const db = new Database(':memory:')
const query = db.query(`CREATE TABLE ${registry} (tag TEXT PRIMARY KEY, path TEXT NOT NULL)`)
query.run()
const cwd = import.meta.dir
const bundle = useBundle(db, registry)
const outputs = await bundle({ cwd })
const map = await getHandlers(outputs)
const ssr = useSSR(db, registry)

Bun.serve({
  fetch(req) {
    const { pathname } = new URL(req.url)
    if (map.has(pathname)) {
      const res = map.get(pathname)
      return res!()
    }
    if (new URL(req.url).pathname === '/sse') {
      console.log('sse')
      return sse(req)
    }
    return new Response(ssr(<Page />), {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  },
  port: 3000,
})
