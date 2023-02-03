import { dockerCompose } from '../templates/mod.ts'
import { getStat } from '../../utils/mod.ts'

type WriteDockerCompose = (args: {
  pat: boolean
  path: string
  port: number
  project?: string
  protocol: 'http' | 'https'
}) => Promise<void>
export const writeDockerCompose: WriteDockerCompose = async ({
  pat,
  path,
  port,
  project,
}) => {
  const exist = await getStat(path)
  !exist && await Deno.writeTextFile(
    path,
    dockerCompose({
      pat,
      port,
      project,
    }),
  )
}
