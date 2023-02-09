import { playwrightConfig } from '../templates/mod.ts'
import { getStat } from '../get-stat.ts'

type WritePlaywrightConfig = (args: {
  path: string
  port: number
  protocol: 'http' | 'https'
  playwright: string
}) => Promise<void>
export const writePlaywrightConfig: WritePlaywrightConfig = async ({
  path,
  port,
  protocol,
  playwright,
}) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFile(
    path,
    playwrightConfig({
      port,
      protocol,
      playwright,
    }),
  )
}
