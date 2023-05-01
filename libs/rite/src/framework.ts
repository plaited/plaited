import { fileURLToPath } from 'url'
import { dirname } from 'path'

export const getFramework = (timeout?: number) => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  return {
    path: `${__dirname}/test-framework.js`,
    config: {
      timeout,
    },
  }
}
