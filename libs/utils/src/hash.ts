/**
 * @summary djb2 hashing function
 */
export const hashString = (str: string) => {
  const hash = [ ...str ].reduce<number>(
    (acc, cur) => ((acc << 5) + acc) + cur.charCodeAt(0),
    5381
  )
  return hash === 5381 ? null : hash
}
