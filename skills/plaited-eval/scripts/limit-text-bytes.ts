export const limitTextBytes = (text: string, maxBytes: number) => {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= maxBytes) {
    return { text, truncated: false, originalBytes: bytes.length }
  }

  const sliced = bytes.slice(0, maxBytes)
  const limited = new TextDecoder().decode(sliced)
  return {
    text: limited,
    truncated: true,
    originalBytes: bytes.length,
  }
}
