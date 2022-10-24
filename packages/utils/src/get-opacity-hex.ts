export const getOpacityHex = () => {
  const hexMap = new Map<number, string>()
  for (let i = 1; i >= 0; i -= 0.01) {
    i = Math.round(i * 100) / 100
    const alpha = Math.round(i * 255)
    const hex = (alpha + 0x10000).toString(16).substr(-2).toUpperCase()
    hexMap.set(i, hex)
  }
  return hexMap
}
