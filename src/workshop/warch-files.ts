import { watch } from 'fs'

const watchDirectory = (root: string) =>
  watch(root, { recursive: true }, (event, filename) => {
    console.log(`Detected ${event} in ${filename}`)
  })
