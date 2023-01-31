import { server } from '../server/mod.ts'
import { WorkshopConfig } from './types.ts'
import {
  write,
  writeDockerCompose,
  writeDockerfile,
  writeGitignore,
  writePackage,
  writePlaywrightConfig,
  writeYarnrc,
} from './write/mod.ts'
import {watcher } from './watcher.ts'
import { defaultStoryHandlers  } from './default-story-handlers.ts'
export const start = async ({ 
  assets,
  colorScheme,
  credentials,
  dev = true,
  errorHandler,
  exts,
  notFoundTemplate,
  pat = false,
  playwright,
  port = 3000,
  project,
  root,
  storyHandlers = defaultStoryHandlers,
  unknownMethodHandler,
}: WorkshopConfig,
) => {
  const dockerComposePath = `${playwright}/docker-compose.yml`
  const dockerFilePath = `${playwright}/Dockerfile`
  const gitignorePath = `${playwright}/.gitignore`
  const packagePath = `${playwright}/package.json`
  const playwrightConfigPath = `${playwright}/playwright.config.ts`
  const yarnrcPath = `${playwright}/.yarnrc.yml`
  const protocol = credentials ? 'https' : 'http'
  if (!Deno.statSync(assets)) {
    console.error(`[ERR] Assets directory ${assets} does not exist!`)
    Deno.exit()
  }
  if (!Deno.statSync(assets).isDirectory) {
    console.error(`[ERR] Assets directory "${assets}" is not directory!`)
    Deno.exit()
  }
  if (!Deno.statSync(root)) {
    console.error(`[ERR] Root directory ${root} does not exist!`)
    Deno.exit()
  }

  if (!Deno.statSync(assets).isDirectory) {
    console.error(`[ERR] Root directory "${assets}" is not directory!`)
    Deno.exit()
  }
  if (!Deno.statSync(playwright)) {
    console.error(`[ERR] Tests directory ${playwright} does not exist!`)
    Deno.exit()
  }
  if (!Deno.statSync(playwright).isDirectory) {
    console.error(`[ERR] Tests directory "${playwright}" is not directory!`)
    Deno.exit()
  }
  if(!Deno.statSync(dockerComposePath)) {
    writeDockerCompose({ pat, path: dockerComposePath, protocol, port, project })
  }
  if(!Deno.statSync(dockerFilePath)) {
    writeDockerfile(dockerFilePath, pat)
  }
  if(!Deno.statSync(gitignorePath)) {
    writeGitignore(gitignorePath)
  }
  if(!Deno.statSync(packagePath)) {
    writePackage(packagePath)
  }
  if(!Deno.statSync(playwrightConfigPath)) {
    writePlaywrightConfig({ path: playwrightConfigPath, port, protocol })
  }
  if(!Deno.statSync(yarnrcPath)) {
    writeYarnrc(yarnrcPath)
  }
  const routes = await write({
    assets,
    colorScheme,
    exts,
    port,
    project,
    root,
    storyHandlers,
    playwright,
  })
  const { updateRoutes} = await server({
    dev,
    routes,
    port,
    root: assets,
    credentials,
    notFoundTemplate,
    errorHandler,
    unknownMethodHandler,
  })
  if(dev) {
    watcher({
      assets,
      colorScheme,
      exts,
      port,
      root,
      storyHandlers,
      playwright,
      updateRoutes
    })
  }
}
