import { mcpGetPrompt } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'
const PROMPT_NAME = 'prompt-name'

const messages = await mcpGetPrompt(MCP_URL, PROMPT_NAME, { arg: 'value' })

for (const message of messages) {
  if (message.content.type === 'text') {
    console.log(message.content.text)
  }
}
