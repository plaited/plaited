import { type ServerResult } from '@modelcontextprotocol/sdk/types.js'
import { ueid } from '../../utils.js'

export const mcpPromisesMap = new Map<
  string,
  { reject: (value: unknown) => void; resolve: (result: ServerResult) => void }
>()

export const createRequestId = () => ueid('mcp_')
