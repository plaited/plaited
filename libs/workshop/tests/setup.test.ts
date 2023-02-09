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
    const dockerCompose = await Deno.readTextFile(
      `${playwright}/docker-compose.yml`,
    )
    await assertSnapshot(t, dockerCompose)
    const dockerFile = await Deno.readTextFile(`${playwright}/Dockerfile`)
    await assertSnapshot(t, dockerFile)
    const gitignore = await Deno.readTextFile(`${playwright}/.gitignore`)
    await assertSnapshot(t, gitignore)
    const packageJson = await Deno.readTextFile(`${playwright}/package.json`)
    await assertSnapshot(t, packageJson)
    const config = await Deno.readTextFile(`${playwright}/playwright.config.ts`)
    await assertSnapshot(t, config)
    const yarnrc = await Deno.readTextFile(`${playwright}/.yarnrc.yml`)
    await assertSnapshot(t, yarnrc)
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
    const dockerCompose = await Deno.readTextFile(
      `${playwright}/docker-compose.yml`,
    )
    await assertSnapshot(t, dockerCompose)
    const dockerFile = await Deno.readTextFile(`${playwright}/Dockerfile`)
    await assertSnapshot(t, dockerFile)
    const gitignore = await Deno.readTextFile(`${playwright}/.gitignore`)
    await assertSnapshot(t, gitignore)
    const packageJson = await Deno.readTextFile(`${playwright}/package.json`)
    await assertSnapshot(t, packageJson)
    const config = await Deno.readTextFile(`${playwright}/playwright.config.ts`)
    await assertSnapshot(t, config)
    const yarnrc = await Deno.readTextFile(`${playwright}/.yarnrc.yml`)
    await assertSnapshot(t, yarnrc)
  })
})
