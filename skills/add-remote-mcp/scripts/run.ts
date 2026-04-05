import { addRemoteMcpCli } from './cli.ts'

export { addRemoteMcpCli }

if (import.meta.main) {
  await addRemoteMcpCli(Bun.argv.slice(2))
}
