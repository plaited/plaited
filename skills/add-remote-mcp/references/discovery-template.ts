import { mcpDiscover, mcpListPrompts, mcpListResources, mcpListTools } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'

const capabilities = await mcpDiscover(MCP_URL)
const tools = await mcpListTools(MCP_URL)
const prompts = await mcpListPrompts(MCP_URL)
const resources = await mcpListResources(MCP_URL)

console.log(
  JSON.stringify(
    {
      capabilities,
      tools,
      prompts,
      resources,
    },
    null,
    2,
  ),
)
