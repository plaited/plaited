import { yarnrc } from '../templates/mod.ts'

type WriteYarnrc = (path: string) => void
export const writeYarnrc: WriteYarnrc = (path) => {
  Deno.writeTextFileSync(
    path,
    yarnrc,
  )
}
