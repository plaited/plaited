import { watch } from 'fs'

export const watchDirectory = (root: string) =>
  watch(root, { recursive: true }, (event, filename) => {
    console.log(`Detected ${event} in ${filename}`)
  })
