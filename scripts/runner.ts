import { defineWorkshop, PUBLIC_EVENTS } from '../src/workshop/define-workshop.js'

const cwd = `${process.cwd()}/src`


const port = 3000

const trigger = await defineWorkshop({
  cwd,
  port,
  development: true
})

trigger({ type: PUBLIC_EVENTS.TEST_ALL_STORIES })
