import { packageJson } from '../templates/mod.ts'

type WritePackage = (path: string) => void
export const writePackage: WritePackage = (path) => {
  Deno.writeTextFileSync(
    path,
    packageJson,
  )
}
