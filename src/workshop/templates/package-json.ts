import { playwrightVersion, yarnVersion } from '../constants.ts'
export const packageJson = `{
  "scripts": {
    "dc": "docker-compose run --rm tests",
    "test": "npx playwright test"
  },
  "dependencies": {
    "@axe-core/playwright": "^4.6.0",
    "@playwright/test": "^${playwrightVersion}",
    "playwright": "^${playwrightVersion}"
  },
  "yarn": "${yarnVersion}",
  "packageManager": "yarn@${yarnVersion}"
}
`
