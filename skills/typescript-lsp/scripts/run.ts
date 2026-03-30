import { typescriptLspCli } from './typescript-lsp.ts'

export { typescriptLspCli }

if (import.meta.main) {
  await typescriptLspCli(Bun.argv.slice(2))
}
