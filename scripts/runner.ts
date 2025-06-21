import { defineWorkshop, PUBLIC_EVENTS } from '../src/workshop/define-workshop.js'

const cwd = `${process.cwd()}/src`

const trigger = await defineWorkshop({
  cwd,
})

trigger({ type: PUBLIC_EVENTS.test_all_stories })
