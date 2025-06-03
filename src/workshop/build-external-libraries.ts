// Define the base artifact type from Bun
type BunBuildArtifact = Bun.BuildOutput['outputs'][number]

// Define a more specific type for entry point artifacts using an intersection
// This ensures it has all properties of BunBuildArtifact AND the specific overrides
type EntryPointBuildArtifact = BunBuildArtifact & {
  kind: 'entry-point' // Narrows the kind
  entrypoint: string // Ensures entrypoint is a non-optional string
}

const isEntryPoint = (output: BunBuildArtifact): output is EntryPointBuildArtifact => output.kind === 'entry-point'

export const buildExternalLibraries = async (
  externalLibraries: string[] = [],
): Promise<{
  outputs: Bun.BuildOutput['outputs']
  importMap: Record<string, string>
}> => {
  const importMap: Record<string, string> = {}
  const buildEntrypoints: string[] = []
  const resolvedPathToLibraryName: Record<string, string> = {}
  const libraries = new Set(['plaited/jsx-runtime', ...externalLibraries])

  for (const libraryName of libraries) {
    try {
      const resolvedPath = Bun.resolveSync(libraryName, process.cwd())
      buildEntrypoints.push(resolvedPath)
      resolvedPathToLibraryName[resolvedPath] = libraryName
    } catch (error) {
      console.warn(`Could not resolve external library "${libraryName}": ${(error as Error).message}`)
    }
  }

  if (buildEntrypoints.length === 0) {
    // This means all libraries failed to resolve or the input array was effectively empty
    return { outputs: [], importMap: {} }
  }

  const { outputs } = await Bun.build({
    entrypoints: buildEntrypoints,
    splitting: true, // Recommended for potentially shared dependencies among external libs
    naming: 'node_modules/[name].[ext]', // Outputs to _node_modules directory structure
    sourcemap: 'inline',
  })
  for (const output of outputs) {
    // We are interested in the entry points to map them back to the original library name
    if (isEntryPoint(output)) {
      // Cast to the more specific type after checking the kind.
      const entryPointArtifact = output
      const originalLibraryName = resolvedPathToLibraryName[entryPointArtifact.entrypoint]
      if (originalLibraryName) {
        // Ensure the path starts with a '/' for typical import map usage
        importMap[originalLibraryName] =
          entryPointArtifact.path.startsWith('/') ? entryPointArtifact.path : `/${entryPointArtifact.path}`
      }
    }
  }

  return {
    outputs,
    importMap,
  }
}
