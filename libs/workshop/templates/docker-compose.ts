import { playwrightVersion } from '../constants.ts'
const tag = `v${playwrightVersion}-jammy`
export const dockerCompose = ({
  pat,
  port,
  project,
}: {
  pat: boolean
  port: number
  project?: string
}) =>
  `services:
tests:
  container_name: ${project ?? 'playwright'}_tests:${tag}
  entrypoint: yarn
  stdin_open: true # docker run -i
  tty: true # docker run -t
  build:
    context: .
    args:
      - TAG=${tag}
      ${pat ? '- GIT_PAT=\${GIT_PAT}' : ''}
  ports:
    - "${port}:${port}"
  volumes:
    - .:/tests:delegated
    - /tests/.yarn
    - /tests/node_modules`
