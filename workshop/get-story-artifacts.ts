export const getStoryArtifacts = async (cwd: string, entrypoints: string[]) => {
  const { outputs } = await Bun.build({
    entrypoints,
    splitting: true,
    root: cwd,
    external: ['plaited'],
    sourcemap: 'inline',
  })
  return outputs
}
