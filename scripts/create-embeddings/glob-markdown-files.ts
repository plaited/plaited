import { Glob } from 'bun'

export async function globMarkdownFiles(directory: string): Promise<string[]> {
  const glob = new Glob('**/*.{md,markdown}')
  const files: string[] = []

  for await (const file of glob.scan(directory)) {
    files.push(file)
  }

  return files
}
