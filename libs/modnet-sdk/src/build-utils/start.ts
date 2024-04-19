import path  from 'node:path'

const getEntryPoints = (filePaths: string[]): string[] => filePaths.filter(filePath => !filePath.split(path.sep).some(part => part.startsWith('_')))

const hasRequiredFile = async (dir:string, ext: '.tsx' | '.jsx') => {
  const rootIndex = Bun.file(`${dir}/index${ext}`)
  const rootLayout = Bun.file(`${dir}/layout${ext}`)
  const index = await rootIndex.exists()
  const layout = await rootLayout.exists()

  !index && console.error(`No root index file found in ${dir}`)
  !layout && console.error(`No root layout file found in ${dir}`)
  return index && layout
}

const bundle = async ({
  entrypoints,
  sourcemap = false,
  publicPath = '',
}: {
  entrypoints: string[]
  sourcemap?: boolean
  publicPath?: string
}) => {
  const result = await Bun.build({
    entrypoints: entrypoints,
    minify: true,
    splitting: true,
    sourcemap: sourcemap ? 'inline' : 'none',
    publicPath,
  })
  return result.outputs
}

export const start = async ({
  dir,
  publicPath,
  sourcemap,
  ext = '.tsx'
}:{
  dir: string
  publicPath?: string
  sourcemap?: boolean
  ext?: '.tsx' | '.jsx'
}) => {
  const requiredFiles = hasRequiredFile(dir, ext)
  if(!requiredFiles) return
  const router = new Bun.FileSystemRouter({
    style: "nextjs",
    dir,
    fileExtensions: [ext]
  });
  const entrypoints = getEntryPoints(Object.values(router.routes))
  const result = await bundle({ entrypoints, sourcemap, publicPath })
  
}