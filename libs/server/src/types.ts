import { BuildArtifact } from 'bun'

export type EntryPath = { path: string; loader: string }

export type Bundles = {
  outputs: (BuildArtifact | EntryPath)[] | never[]
  __dirname: string
}
