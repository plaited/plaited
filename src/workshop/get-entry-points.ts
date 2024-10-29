export const getEntryPoints = (imports: Record<string, `${string}.js`>) => {
  const entryPoints: { out: string; in: string }[] = []
  for (const key in imports) {
    const out = imports[key].replace(/\.js$/, '')
    entryPoints.push({ out: out, in: key })
  }
  return entryPoints
}
