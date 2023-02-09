import { dockerFile } from '../templates/mod.ts'
import { getStat } from '../get-stat.ts'

export const writeDockerfile = async (path: string, pat: boolean) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFileSync(
    path,
    dockerFile(pat),
  )
}