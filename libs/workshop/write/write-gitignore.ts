import { gitignore } from '../templates/mod.ts'
import { getStat } from '../get-stat.ts'

export const writeGitignore = async (path: string) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFileSync(
    path,
    gitignore,
  )
}
