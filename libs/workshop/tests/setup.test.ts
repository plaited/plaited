import { afterEach, assertSnapshot, describe, it } from '../../test-deps.ts'
import { resolve } from '../../deps.ts'
import { setup } from '../setup.ts'

const __dirname = new URL('.', import.meta.url).pathname
const playwright = resolve(__dirname, './__tmp__/setup')

describe('Setup', () => {
  afterEach(async () => {
    await Deno.remove(playwright, { recursive: true })
  })
  it('setup: required', async (t) => {
    await setup({
      playwright,
      port: 3000,
    })
    await assertSnapshot(t, `${playwright}/docker-compose.yml`)
    await assertSnapshot(t, `${playwright}/Dockerfile`)
    await assertSnapshot(t, `${playwright}/.gitignore`)
    await assertSnapshot(t, `${playwright}/package.json`)
    await assertSnapshot(t, `${playwright}/playwright.config.ts`)
    await assertSnapshot(t, `${playwright}/.yarnrc.yml`)
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
    await assertSnapshot(t, `${playwright}/docker-compose.yml`)
    await assertSnapshot(t, `${playwright}/Dockerfile`)
    await assertSnapshot(t, `${playwright}/.gitignore`)
    await assertSnapshot(t, `${playwright}/package.json`)
    await assertSnapshot(t, `${playwright}/playwright.config.ts`)
    await assertSnapshot(t, `${playwright}/.yarnrc.yml`)
  })
})
