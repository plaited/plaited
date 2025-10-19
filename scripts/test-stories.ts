import { runTestsViaMcp } from '../src/workshop/workshop.utils.js'

const cwd = `${process.cwd()}/src`
const serverCommand = 'bun'
const serverArgs = [Bun.resolveSync('../src/workshop/tool-test-stories/test-mcp-server.ts', import.meta.dir)]

// Run tests via MCP
await runTestsViaMcp({
  cwd,
  serverCommand,
  serverArgs,
  colorSchemeSupport: false,
  hostName: 'http://localhost:3456',
})
