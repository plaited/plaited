import { dockerCompose } from '../templates/mod.ts'

type WriteDockerCompose = (args: {
  pat: boolean
  path: string
  port: number
  project?: string
  protocol: 'http' | 'https'
}) => void
export const writeDockerCompose: WriteDockerCompose = ({
  pat,
  path,
  port,
  project,
}) => {
  Deno.writeTextFileSync(
    path,
    dockerCompose({
      pat,
      port,
      project,
    }),
  )
}
