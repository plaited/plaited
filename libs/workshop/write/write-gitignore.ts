import { gitignore } from '../templates/mod.ts'

type WriteGitignore = (path: string) => void
export const writeGitignore: WriteGitignore = (path) => {
  Deno.writeTextFileSync(
    path,
    gitignore,
  )
}
