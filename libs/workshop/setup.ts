import { WorkshopSetupConfig } from './types.ts'
import {
  writeDockerCompose,
  writeDockerfile,
  writeGitignore,
  writePackage,
  writePlaywrightConfig,
  writeYarnrc,
} from './write/mod.ts'
import { getStat } from './get-stat.ts'

export const setup = async ({
  credentials,
  pat = false,
  playwright,
  port = 3000,
  project,
}: WorkshopSetupConfig) => {
  const protocol = credentials ? 'https' : 'http'
  const exist = await getStat(playwright)
  if (!exist) {
    await Deno.mkdir(playwright, { recursive: true })
  }
  await Promise.all([
    () =>
      writeDockerCompose({
        pat,
        path: `${playwright}/docker-compose.yml`,
        protocol,
        port,
        project,
      }),
    () => writeDockerfile(`${playwright}/Dockerfile`, pat),
    () => writeGitignore(`${playwright}/.gitignore`),
    () => writePackage(`${playwright}/package.json`),
    () =>
      writePlaywrightConfig({
        path: `${playwright}/playwright.config.ts`,
        port,
        protocol,
      }),
    () => writeYarnrc(`${playwright}/.yarnrc.yml`),
  ].map(async (task) => await task()))
}
