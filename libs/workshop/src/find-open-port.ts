import net from 'node:net'

const MAX_ATTEMPTS = 1000
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
      port += 1
    }
  }
  throw new Error(`Could not find an open port after ${MAX_ATTEMPTS} attempts`)
}
