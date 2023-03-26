import { assert, AssertionError } from '$assert'
import { css, html, render } from '$plaited'

/** open web socket connection */
const hostRegex = /(^https?:\/\/[^\/]+)\/.*$/i
const host = document.URL.replace(hostRegex, '$1')

/** Fetching test pass */
let data: string[] = []
try {
  const res = await fetch(`${host}/tests`, {
    method: 'GET',
  })
  data = await res.json()
} catch (err) {
  console.error(err)
}

const getPage = (urlString: string) => {
  // Create a new URL object
  const url = new URL(urlString)

  // Get the pathname and split it using '/'
  const pathParts = url.pathname.split('/')

  // Remove the last element (the filename)
  pathParts.pop()

  // Extract the last directory
  return pathParts[pathParts.length - 1]
}

/** format test paths */
const testPaths = data.map((path) => `${host}/${getPage(`${host}${path}`)}`)

/** test shouldn't take more than 5 seconds */
const throwTimeoutError = async () => {
  const timeout = 5_000
  await assert.wait(5_000)
  throw new AssertionError(`test takes longer than ${timeout}ms to complete`)
}

let passed = 0
let failed = 0
const body = document.querySelector('body')
const { styles, classes } = css`
.test-fixture{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25px;
  justify-items: stretch;
}
.test-frame {
  display:block;
  min-height: 500px;
}
`
body && render(
  body,
  html`
<style>${styles}</style>
<div id="fixture" class="${classes['test-fixture']}">

</div>
`,
  'afterbegin',
)

const run = (id: string): Promise<HTMLBodyElement> => {
  const frame = document.createElement('iframe')
  frame.src = id
  frame.className = classes['test-frame']
  document.querySelector('#fixture')?.append(frame)
  /** sometimes you need to wait for the next frame */
  return new Promise((resolve) => {
    const context = frame?.contentDocument?.body as HTMLBodyElement
    // deno-lint-ignore no-window-prefix
    window.addEventListener('message', (event) => {
      const { ok, name } = event.data as {
        ok: boolean
        name: string
      }
      console.log(ok, name)
      ok ? passed++ : failed++
      resolve(context)
    })
  })
}

/** loop over tests imports */
console.log('RUN_START')

await Promise.all(testPaths.map(async (path) => {
  await Promise.race([run(path), throwTimeoutError()])
}))

console.log('RUN_END')
console.log('ALI WUZ HERE')

console.log(`${passed} passed, ${failed} failed`)
