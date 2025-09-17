export const getNormalizedPath = (filePath: string) => {
  // Normalize path separators to forward slashes for consistent cross-platform behavior
  let normalizedPath = filePath.replace(/\\/g, '/')

  // Handle Windows absolute paths (C:/path -> /path)
  if (normalizedPath.match(/^[A-Za-z]:/)) {
    normalizedPath = normalizedPath.replace(/^[A-Za-z]:/, '')
  }
  return normalizedPath
}
