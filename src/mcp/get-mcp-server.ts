import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import packageJson from '../../package.json' with { type: 'json' }

export const getMcpServer = () =>
  new McpServer(
    {
      name: 'plaited-server',
      version: packageJson.version,
    },
    {
      capabilities: {
        logging: {},
        tools: { listChanged: true },
      },
      instructions: 'Use this server to create user interfaces with plaited',
    },
  )
