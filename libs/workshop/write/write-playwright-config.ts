import { playwrightConfig } from '../templates/mod.ts'
type WritePlaywrightConfig = (args: {
  path: string
  port: number
  protocol: 'http' | 'https'
}) => void
export const writePlaywrightConfig: WritePlaywrightConfig = ({
  path,
  port,
  protocol,
}) => {
  Deno.writeTextFileSync(
    path,
    playwrightConfig(
      port,
      protocol,
    ),
  )
}
