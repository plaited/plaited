import { kebabCase } from '@plaited/utils'

export const toId = (title: string, name?: string) =>
  name ? `${kebabCase(title)}--${kebabCase(name)}` : kebabCase(title)
