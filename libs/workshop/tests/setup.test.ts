import {
  afterEach,
  assert,
  assertSnapshot,
  describe,
  it,
  resolve,
} from '../../test-deps.ts'
import { walk } from '../../deps.ts'
import { setup } from '../setup.ts'

const __dirname = new URL('.', import.meta.url).pathname
const playwright = resolve(__dirname, './__tmp__/')

const files = [
  `${playwright}/docker-compose.yml`,
  `${playwright}/Dockerfile`,
  `${playwright}/.gitignore`,
  `${playwright}/package.json`,
  `${playwright}/playwright.config.ts`,
  `${playwright}/.yarnrc.yml`,
]

describe('Setup', () => {
  afterEach(async () => {
    await Deno.remove(playwright, { recursive: true })
  })
  it('setup: required', async (t) => {
    await setup({
      playwright,
      port: 3000,
    })
    for await (const { path, isFile } of walk(playwright, { maxDepth: 1 })) {
      if (isFile) {
        assert(files.includes(path))
        const file = await Deno.readTextFile(path)
        assertSnapshot(t, file)
      }
    }
  })
  it('setup: optional', async (t) => {
    await setup({
      playwright,
      port: 3000,
      pat: true,
      credentials: {
        cert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n',
        key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      },
      project: 'test',
    })
    for await (const { path, isFile } of walk(playwright, { maxDepth: 1 })) {
      if (isFile) {
        assert(files.includes(path))
        const file = await Deno.readTextFile(path)
        assertSnapshot(t, file)
      }
    }
  })
})
