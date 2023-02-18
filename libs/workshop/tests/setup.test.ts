// import { assertSnapshot } from '../../test-deps.ts'
// import { basename, resolve } from '../../deps.ts'
// import { setup } from '../setup.ts'

// const __dirname = new URL('.', import.meta.url).pathname
// const playwright = resolve(__dirname, './__tmp__/setup')

// const files = [
//   `${playwright}/docker-compose.yml`,
//   `${playwright}/Dockerfile`,
//   `${playwright}/.gitignore`,
//   `${playwright}/package.json`,
//   `${playwright}/playwright.config.ts`,
//   `${playwright}/.yarnrc.yml`,
// ]

// Deno.test('setup: required', async (t) => {
//   await setup({
//     playwright,
//     port: 3000,
//   })
//   for (const path of files) {
//     const contents = await Deno.readTextFile(path)
//     await assertSnapshot(t, contents, { name: basename(path) })
//   }
//   await t.step('teardown', async () => {
//     await Deno.remove(playwright, { recursive: true })
//   })
// })
// Deno.test('setup: optional', async (t) => {
//   await setup({
//     playwright,
//     port: 3000,
//     pat: true,
//     credentials: {
//       cert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n',
//       key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
//     },
//     project: 'test',
//   })
//   for (const path of files) {
//     const contents = await Deno.readTextFile(path)
//     await assertSnapshot(t, contents, { name: `${basename(path)}-https` })
//   }
//   await t.step('teardown', async () => {
//     await Deno.remove(playwright, { recursive: true })
//   })
// })
