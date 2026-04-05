/**
 * Sample fixture for LSP tests
 */
export type Config = {
  name: string
  value: number
}

export const parseConfig = (input: string): Config => {
  return { name: input, value: 42 }
}

export const validateInput = (input: unknown): input is string => {
  return typeof input === 'string'
}

export const onlyUsedInTests = () => {
  return 'test-only'
}

export const unusedValue = 42

export class ConfigManager {
  #config: Config | null = null

  load(input: string): void {
    this.#config = parseConfig(input)
  }

  get(): Config | null {
    return this.#config
  }
}
