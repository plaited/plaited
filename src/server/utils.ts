export const usePort = (port: number = 0) => {
	try {
	  const server = Deno.listen({ port, transport: "tcp" });
    if(port === 0) {
      const x = ( server.addr as Deno.NetAddr).port
      server.close();
      return x;
    }
    server.close();
    return port;
	} catch (e) {
		if (e.name !== 'AddrInUse') throw e;
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

export const getMessage = (channel:string, data:string) => {
  const encoder = new TextEncoder()
  return encoder.encode(`event: ${channel}\nid: 0\ndata: ${data}\n`)
}

