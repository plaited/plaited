export const __dirname = new URL('.', import.meta.url).pathname
export const root = `${__dirname}/assets`

export const home = '<link rel="stylesheet" href="./styles.css"><h1>Home</h1>'
export const help =
  '<link rel="stylesheet" href="./new-styles.css"><h1>Help</h1>'
export const homeRoute = {
  '/': () => ssr(home),
}

export const helpRoute = {
  '/help': () => ssr(help),
}

export const newStyles = `
body {
  color: rebeccapurple;
  font-size: 12px;
}
`
export const ssr = (html: string) => {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
