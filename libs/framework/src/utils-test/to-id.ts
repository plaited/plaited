import { kebabCase } from '../utils.js'

export const toId = (title: string, name?: string) =>
  name ? `${kebabCase(title)}--${kebabCase(name)}` : kebabCase(title)
