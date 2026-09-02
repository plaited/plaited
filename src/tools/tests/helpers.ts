import * as path from 'node:path'

/**
 * Create a temp directory with the given files.
 * Returns the dir path and a cleanup function.
 */
const tempDir = async (files: Record<string, string>): Promise<{ dir: string; cleanup: () => Promise<void> }> => {
  const dir = await Bun.$`mktemp -d`
    .quiet()
    .text()
    .then((s) => s.trim())
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name)
    const parentDir = path.dirname(fullPath)
    await Bun.$`mkdir -p ${parentDir}`.quiet().nothrow()
    await Bun.write(fullPath, content)
  }
  return {
    dir,
    cleanup: async () => {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    },
  }
}

export { tempDir }
