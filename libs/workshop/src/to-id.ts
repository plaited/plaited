import { kebabCase } from '@plaited/utils'

export const toId = (title: string, name: string) =>
  `${kebabCase(title)}--${kebabCase(name)}`
