import { packageJson } from '../templates/mod.ts'
import { getStat } from '../get-stat.ts'

export const writePackage = async (path: string) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFileSync(
    path,
    packageJson,
  )
}
