export type TemplateParams = {
  triggers?: Record<string, string>
  targets?: Record<string, string>
  className?: string
  htmlFor?: string
  for: never
  class: never
  [key: string]: unknown
}

export type Template<T = TemplateParams> = (args: T) => string
