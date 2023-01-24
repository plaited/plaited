export const cssVar = (variable: `var(--${string})` | `--${string}`, value?: string | number, rem = true) => {
  const name = variable.startsWith('var(')
    ? variable.substring(4, variable.length - 5)
    : variable
  let val: string | undefined
  if(typeof value === 'number' && rem) {
    const baseFontSize = parseInt(getComputedStyle(document.documentElement).fontSize)
    val = `${value/baseFontSize}rem`
  }
  value && document.documentElement.style.setProperty(name, val || value.toString())
  return getComputedStyle(document.documentElement).getPropertyValue(name)
}
