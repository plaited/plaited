export type PageOptions = {
  output: string
  background?: `var(${string})`
  color?: `var(${string})`
  designTokens?: string
}

export type WorkshopParams = {
  cwd: string
  port?: number
} & PageOptions
