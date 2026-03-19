import { mcpReadResource } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'
const RESOURCE_URI = 'resource://schemas/config.json'

const contents = await mcpReadResource(MCP_URL, RESOURCE_URI)

for (const content of contents) {
  if (content.text) {
    console.log(content.text)
  }
}
