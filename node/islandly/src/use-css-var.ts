/// <reference lib="dom" />
/** @description
 * set and get document level css variables
 */
export const useCSSVar = (variable: `var(--${string})` | `--${string}`) => {
  const name = variable.startsWith('var(')
    ? variable.substring(4, variable.length - 5)
    : variable
  const get = () =>
    getComputedStyle(document.documentElement).getPropertyValue(name)
  const set = (value: string | number, rem = true) => {
    let val: string | undefined
    if (typeof value === 'number' && rem) {
      const baseFontSize = parseInt(
        getComputedStyle(document.documentElement).fontSize
      )
      val = `${value / baseFontSize}rem`
    }
    document.documentElement.style.setProperty(name, val || value.toString())
  }
  return Object.freeze<
    [() => string, (value: string | number, rem?: boolean) => void]
      >([
        get,
        set,
      ])
}
