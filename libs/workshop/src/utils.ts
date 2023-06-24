import { kebabCase } from '@plaited/utils'
import net from 'node:net'

// Utility for finding an open port for dev server
export const MAX_ATTEMPTS = 1000
export const findOpenPort = async (port: number) => {
  for(let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
    try {
      return new Promise<number>((resolve, reject) => {
        const server = net.createServer()
        server.unref()
        server.on('error', reject)
        server.listen(port, () => {
          const address = server.address()
          if (address && typeof address === 'object') {
            server.close(() => resolve(address.port))
          }
        })
      })
    } catch (error) {
      console.log({ error })
      port += 1
    }
  }
  throw new Error(`Could not find an open port after ${MAX_ATTEMPTS} attempts`)
}


// Create story id from story set tile and story export name
export const toId = (title: string, name: string) =>
  `${kebabCase(title)}--${kebabCase(name)}`

// used to remove leading slash from handler keys fro cleaning up handlers map
export const removeLeadingSlash = (input: string): string => {
  if (input.startsWith('/')) {
    return input.slice(1)
  }
  return input
}

// Live reload constant value
export const LIVE_RELOAD = '/livereload'
