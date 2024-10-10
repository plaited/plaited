/**
 * Returns a debounced version of the provided function that delays its execution until the specified time has elapsed since the last time it was called.
 * @param func - The function to debounce.
 * @param waitFor - The number of milliseconds to wait before executing the debounced function.
 * @returns A debounced version of the provided function.
 * @example
 * const debounced = debounce(console.log('hi'), 100)
 * debounced() // => 'hi' (after 100ms)
 */
export const useDebounce = <F extends (...args: Parameters<F>) => ReturnType<F>>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: Parameters<F>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), waitFor)
  }

  return debounced
}
