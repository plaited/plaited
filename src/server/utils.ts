export const usePort = (port = 0) => {
  try {
    const server = Deno.listen({ port, transport: 'tcp' })
    if(port === 0) {
      const x = ( server.addr as Deno.NetAddr).port
      server.close()
      return x
    }
    server.close()
    return port
  } catch (e) {
    if (e.name !== 'AddrInUse') throw e
    else return 0
  }
}


export const networkIps: string[] = []
const arr = Deno.networkInterfaces()
for(const i of arr) {
  if(i.family === 'IPv4' && i.address !== '127.0.0.1') {
    networkIps.push(i.address)
  }
}

export const hostnameForDisplay = (hostname: string) =>{
  // If the hostname is "0.0.0.0", we display "localhost" in console
  // because browsers in Windows don't resolve "0.0.0.0".
  // See the discussion in https://github.com/denoland/deno_std/issues/1165
  return hostname === "0.0.0.0" ? "localhost" : hostname;
}
