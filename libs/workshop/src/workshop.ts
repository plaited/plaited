import { Config } from './types.js'
export const workshop = ({ output = '.playwright', port = 3000, tokens, assets }: Config) => {
  const testDir = `${process.cwd()}/${output}`
  
}
