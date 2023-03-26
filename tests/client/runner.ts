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

const root = document.querySelector('#root')
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
root && render(
  root,
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
    requestAnimationFrame(() => {
      resolve(context)
    })
  })
}

await Promise.all(testPaths.map(async (path) => {
  await run(path)
}))
