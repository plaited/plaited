import fs from 'fs/promises'
export const getComponentDirs = async  (source: string) => {
  const componentDirectories: string[] = []
  try {
    const files = await fs.readdir(source, { withFileTypes: true })
    for(const file of files) {
      file.isDirectory() && componentDirectories.push(file.name)
    }
  } catch (err) {
    console.error(err)
  }
  return componentDirectories
}
