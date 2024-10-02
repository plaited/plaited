import { usePlugin } from './use-plugin.js'

export const build = async (root: string, entrypoints: string[]) => {
  const isProd = process.env.NODE_ENV === 'production'
  return await Bun.build({
    root,
    entrypoints,
    sourcemap: isProd ? 'none' : 'inline',
    minify: isProd,
    splitting: true,
    publicPath: '/',
    plugins: [usePlugin(root)],
  })
}
