import { Glob } from 'bun'

export async function globStoryFiles(directory: string): Promise<string[]> {
  const glob = new Glob('**/*.stories.{ts,tsx}')
  const files: string[] = []

  for await (const file of glob.scan(directory)) {
    files.push(file)
  }

  return files
}
