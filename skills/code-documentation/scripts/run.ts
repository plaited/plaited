import { codeDocumentationCli } from './code-documentation.ts'

export { codeDocumentationCli }

if (import.meta.main) {
  await codeDocumentationCli(Bun.argv.slice(2))
}
