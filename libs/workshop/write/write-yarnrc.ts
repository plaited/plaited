import { yarnrc } from '../templates/mod.ts'
import { getStat } from '../../deno-utils/mod.ts'

export const writeYarnrc = async (path: string) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFile(
    path,
    yarnrc,
  )
}
