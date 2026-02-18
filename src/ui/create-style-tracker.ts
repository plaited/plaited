export const createStyleTracker = () => {
  const sent = new Set<string>()
  return {
    dedupe(stylesheets: string[]) {
      const fresh: string[] = []
      for (const sheet of stylesheets) {
        if (sent.has(sheet)) continue
        fresh.push(sheet)
        sent.add(sheet)
      }
      return fresh.length ? `<style>${fresh.join('')}</style>` : ''
    },
    reset: sent.clear,
  }
}
