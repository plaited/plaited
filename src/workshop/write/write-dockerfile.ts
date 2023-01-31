import { dockerFile} from '../templates/mod.ts'
  
type WriteDockerfile = (path: string, pat:boolean) => void
export const writeDockerfile:WriteDockerfile = (path, pat) => {
  Deno.writeTextFileSync(
    path, 
    dockerFile(pat)
  )
}