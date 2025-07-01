import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'bun',
  args: [`${import.meta.dir}/mcp-server.ts`],
})

const client = new Client({
  name: 'test-client',
  version: '0.0.1',
})

await client.connect(transport)

// const href = await client.callTool({
//   name: PUBLIC_EVENTS.get_workshop_href,
//   arguments: {
//     root: `${process.cwd()}/src`,
//   },
// })
// console.log(href)

// const urls = await client.callTool({
//   name: PUBLIC_EVENTS.get_story_routes,
// })
// console.log(urls)
