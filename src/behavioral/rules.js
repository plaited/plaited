const idiom = key => (...idioms) => {
  return {
    [key]: [...idioms],
  }
}
export const waitFor = idiom('waitFor')
export const block = idiom('block')
export const request = idiom('request')
