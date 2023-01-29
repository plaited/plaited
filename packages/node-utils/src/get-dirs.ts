import fs from 'fs/promises'
export const getDirs = async  (source: string) => {
  const dirs: string[] = []
  try {
    const files = await fs.readdir(source, { withFileTypes: true })
    for(const file of files) {
      file.isDirectory() && dirs.push(file.name)
    }
  } catch (err) {
    console.error(err)
  }
  return dirs
}
