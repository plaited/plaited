/**
 * TypeScript LSP MCP Server
 *
 * @remarks
 * An MCP server that exposes TypeScript Language Server Protocol functionality as tools.
 * Uses Bun.spawn to run typescript-language-server and wraps LSP methods as MCP tools.
 *
 * @internal
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { LspClient } from './lsp-client.ts'

/**
 * Create and run the TypeScript LSP MCP server
 */
export const createLspMcpServer = async ({ rootUri, command }: { rootUri: string; command?: string[] }) => {
  const lspClient = new LspClient({ rootUri, command })

  const server = new McpServer({
    name: 'typescript-lsp',
    version: '1.0.0',
  })

  // Tool: Start LSP server
  server.registerTool(
    'lsp_start',
    {
      description: 'Start the TypeScript Language Server. Must be called before using other LSP tools.',
      inputSchema: {},
    },
    async () => {
      if (lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server is already running' }],
        }
      }

      try {
        await lspClient.start()
        return {
          content: [{ type: 'text', text: 'LSP server started successfully' }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Failed to start LSP server: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Stop LSP server
  server.registerTool(
    'lsp_stop',
    {
      description: 'Stop the TypeScript Language Server.',
      inputSchema: {},
    },
    async () => {
      try {
        await lspClient.stop()
        return {
          content: [{ type: 'text', text: 'LSP server stopped' }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Failed to stop LSP server: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Open document
  server.registerTool(
    'lsp_open_document',
    {
      description:
        'Open a TypeScript/JavaScript document in the LSP server. Required before using hover, definition, etc.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
      },
    },
    async ({ filePath }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const file = Bun.file(filePath)
        const text = await file.text()
        const uri = `file://${filePath}`
        const languageId = filePath.endsWith('.tsx')
          ? 'typescriptreact'
          : filePath.endsWith('.ts')
            ? 'typescript'
            : filePath.endsWith('.jsx')
              ? 'javascriptreact'
              : 'javascript'

        lspClient.openDocument(uri, languageId, 1, text)

        return {
          content: [{ type: 'text', text: `Opened document: ${filePath}` }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Failed to open document: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Close document
  server.registerTool(
    'lsp_close_document',
    {
      description: 'Close a document in the LSP server.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
      },
    },
    async ({ filePath }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running.' }],
          isError: true,
        }
      }

      const uri = `file://${filePath}`
      lspClient.closeDocument(uri)

      return {
        content: [{ type: 'text', text: `Closed document: ${filePath}` }],
      }
    },
  )

  // Tool: Hover
  server.registerTool(
    'lsp_hover',
    {
      description:
        'Get type information and documentation at a position in a file. Returns hover information including type signatures and JSDoc.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (0-indexed)'),
        character: z.number().describe('Character position in the line (0-indexed)'),
      },
    },
    async ({ filePath, line, character }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const uri = `file://${filePath}`
        const result = await lspClient.hover(uri, line, character)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Hover failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Go to Definition
  server.registerTool(
    'lsp_definition',
    {
      description: 'Find the definition of a symbol at a position. Returns file path and location of the definition.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (0-indexed)'),
        character: z.number().describe('Character position in the line (0-indexed)'),
      },
    },
    async ({ filePath, line, character }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const uri = `file://${filePath}`
        const result = await lspClient.definition(uri, line, character)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Definition failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Find References
  server.registerTool(
    'lsp_references',
    {
      description: 'Find all references to a symbol at a position. Returns list of locations where the symbol is used.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (0-indexed)'),
        character: z.number().describe('Character position in the line (0-indexed)'),
        includeDeclaration: z.boolean().optional().describe('Include the declaration in results (default: true)'),
      },
    },
    async ({ filePath, line, character, includeDeclaration }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const uri = `file://${filePath}`
        const result = await lspClient.references(uri, line, character, includeDeclaration ?? true)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `References failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Get Completions
  server.registerTool(
    'lsp_completion',
    {
      description: 'Get code completion suggestions at a position.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (0-indexed)'),
        character: z.number().describe('Character position in the line (0-indexed)'),
      },
    },
    async ({ filePath, line, character }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const uri = `file://${filePath}`
        const result = await lspClient.completion(uri, line, character)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Completion failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Signature Help
  server.registerTool(
    'lsp_signature_help',
    {
      description: 'Get function signature help at a position. Useful when inside function call parentheses.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (0-indexed)'),
        character: z.number().describe('Character position in the line (0-indexed)'),
      },
    },
    async ({ filePath, line, character }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const uri = `file://${filePath}`
        const result = await lspClient.signatureHelp(uri, line, character)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Signature help failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Document Symbols
  server.registerTool(
    'lsp_document_symbols',
    {
      description: 'Get all symbols (functions, classes, variables, etc.) in a document.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the file'),
      },
    },
    async ({ filePath }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const uri = `file://${filePath}`
        const result = await lspClient.documentSymbols(uri)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Document symbols failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  // Tool: Workspace Symbols
  server.registerTool(
    'lsp_workspace_symbols',
    {
      description: 'Search for symbols across the entire workspace by name.',
      inputSchema: {
        query: z.string().describe('Symbol name or partial name to search for'),
      },
    },
    async ({ query }) => {
      if (!lspClient.isRunning()) {
        return {
          content: [{ type: 'text', text: 'LSP server not running. Call lsp_start first.' }],
          isError: true,
        }
      }

      try {
        const result = await lspClient.workspaceSymbols(query)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Workspace symbols failed: ${error}` }],
          isError: true,
        }
      }
    },
  )

  return { server, lspClient }
}

/**
 * Run the MCP server with stdio transport
 */
export const runLspMcpServer = async (rootUri: string, command?: string[]) => {
  const { server, lspClient } = await createLspMcpServer({ rootUri, command })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await lspClient.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await lspClient.stop()
    process.exit(0)
  })

  console.error('TypeScript LSP MCP Server running on stdio')
}
