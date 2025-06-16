import { defineWorkshop, PUBLIC_EVENTS } from '../src/workshop/define-workshop.js'

const cwd = `${process.cwd()}/src`

const development = {
  hmr: true,
  console: true,
}

const port = 3000

const trigger = await defineWorkshop({
  cwd,
  development,
  port,
})

trigger({ type: PUBLIC_EVENTS.LIST_ROUTES })
