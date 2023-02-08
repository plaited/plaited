import { gitignore } from '../templates/mod.ts'
import { getStat } from '../../deno-utils/mod.ts'

export const writeGitignore = async (path: string) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFileSync(
    path,
    gitignore,
  )
}
