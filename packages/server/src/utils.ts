import os from 'os'
import net from 'net'
import { ServerResponse } from 'http'

export const usePort = async (port = 0) =>
  new Promise<number>((ok, x) => {
    const s = net.createServer()
    s.on('error', x)
    s.listen(port, () => {
      const a = s.address()
      return a && typeof a === 'object' && s.close(() => ok(a.port ))
    }
    )
  })

const networkIps: string[] = []
const arr = Object.values(os.networkInterfaces()).flatMap(i => i ?? [])
for(const i of arr) {
  if(i.family === 'IPv4' && i.internal === false) {
    networkIps.push(i.address)
  }
}
export { networkIps }

export const utf8 = (file: string) => Buffer.from(file, 'binary').toString('utf8')

export const sendMessage = (res:ServerResponse, channel:string, data:string) => {
  res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`)
  res.write('\n\n')
}

