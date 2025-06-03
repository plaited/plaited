import { Glob } from 'bun'

export async function globFiles(directory: string, pattern: string): Promise<string[]> {
  const glob = new Glob(pattern)
  return await Array.fromAsync(glob.scan(directory))
}
