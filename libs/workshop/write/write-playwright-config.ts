import { playwrightConfig } from '../templates/mod.ts'
import { getStat } from '../../deno-utils/mod.ts'

type WritePlaywrightConfig = (args: {
  path: string
  port: number
  protocol: 'http' | 'https'
}) => Promise<void>
export const writePlaywrightConfig: WritePlaywrightConfig = async ({
  path,
  port,
  protocol,
}) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFile(
    path,
    playwrightConfig(
      port,
      protocol,
    ),
  )
}
