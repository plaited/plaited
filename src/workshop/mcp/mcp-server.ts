import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { defineWorkshop, PUBLIC_EVENTS } from '../plaited/src/workshop/define-workshop.js'

const mcpServer = new McpServer({
  name: 'plaited-workshop',
  version: '1.0.0',
})

const cwd = `${process.cwd()}/src`

const trigger = await defineWorkshop({
  cwd,
  mcpServer,
})

trigger({ type: PUBLIC_EVENTS.test_all_stories })
