import { kebabCase } from '../deps.ts'

export const toId = (title: string, name: string) =>
  `${kebabCase(title)}--${kebabCase(name)}`
