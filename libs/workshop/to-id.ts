const sanitize = (string: string) => {
  return (
    string
      .toLowerCase()
      // eslint-disable-next-line no-useless-escape
      .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  )
}

const sanitizeSafe = (string: string, part: string) => {
  const sanitized = sanitize(string)
  if (sanitized === '') {
    throw new Error(
      `Invalid ${part} '${string}', must include alphanumeric characters`,
    )
  }
  return sanitized
}

export const toId = (title: string, name?: string) =>
  `${sanitizeSafe(title, 'title')}${
    name ? `--${sanitizeSafe(name, 'name')}` : ''
  }`
