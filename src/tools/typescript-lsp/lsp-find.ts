#!/usr/bin/env bun
/**
 * Search for TypeScript symbols across the workspace by name
 *
 * Usage: bun lsp-find.ts <query> <context-file>
 */

import { parseArgs } from 'node:util'
import { LspClient } from './lsp-client.ts'
import { resolveFilePath } from './resolve-file-path.ts'

/**
 * Search for TypeScript symbols across the workspace by name
 *
 * @param args - Command line arguments [query, context-file]
 */
export const lspFind = async (args: string[]) => {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
  })

  const [query, filePath] = positionals

  if (!query || !filePath) {
    console.error('Error: context-file required')
    console.error('')
    console.error('lsp-find searches TypeScript SYMBOLS (functions, types, classes).')
    console.error('  - Use Glob to find files by pattern')
    console.error('  - Use Grep to search text content')
    console.error('  - Use lsp-find <query> <context-file> for symbol search')
    console.error('')
    console.error('Provide any .ts file as context-file (e.g., src/app.ts)')
    process.exit(1)
  }

  const rootUri = `file://${process.cwd()}`
  const client = new LspClient({ rootUri })

  try {
    await client.start()

    const contextFile = resolveFilePath(filePath)

    const file = Bun.file(contextFile)
    if (!(await file.exists())) {
      console.error(`Error: Context file not found: ${contextFile}`)
      console.error('Workspace symbol search requires at least one open document.')
      await client.stop()
      process.exit(1)
    }

    const text = await file.text()
    const uri = `file://${contextFile}`
    const languageId = contextFile.endsWith('.tsx')
      ? 'typescriptreact'
      : contextFile.endsWith('.ts')
        ? 'typescript'
        : contextFile.endsWith('.jsx')
          ? 'javascriptreact'
          : 'javascript'

    client.openDocument(uri, languageId, 1, text)

    const result = await client.workspaceSymbols(query)

    client.closeDocument(uri)
    await client.stop()

    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Error:', error)
    await client.stop()
    process.exit(1)
  }
}

// Keep executable entry point for direct execution
if (import.meta.main) {
  await lspFind(Bun.argv.slice(2))
}
