import { wait } from '../utils/mod.ts'

export const watcher = async (
  cb: () => void,
  root: string
) => {
  const watcher = Deno.watchFs(root, { recursive: true })
  for await (const { kind } of watcher) {
    if (
      kind === 'modify'
    ) {
      cb()
    }
    await wait(100)
  }
}
