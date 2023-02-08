import { yarnrc } from '../templates/mod.ts'
import { getStat } from '../get-stat.ts'

export const writeYarnrc = async (path: string) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFile(
    path,
    yarnrc,
  )
}
