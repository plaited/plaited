/**
 * a function for returning an unique enough id when you need it
 */
export const ueid = (prefix = '') => {
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toLowerCase()
  return String(prefix) + id
}
