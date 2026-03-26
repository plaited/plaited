export const extractFirstJsonObject = (text: string): string | null => {
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0) {
        continue
      }
      depth -= 1
      if (depth === 0 && start !== -1) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

export const extractTaggedJsonObject = ({ text, tag }: { text: string; tag: string }): string | null => {
  const open = `<${tag}>`
  const close = `</${tag}>`
  const start = text.indexOf(open)
  if (start === -1) {
    return null
  }
  const end = text.indexOf(close, start + open.length)
  if (end === -1) {
    return null
  }

  const inner = text.slice(start + open.length, end).trim()
  return inner || null
}
