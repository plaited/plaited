export type KeyMirror<Keys extends string[]> = {
  readonly [K in Keys[number]]: K
}

/** create an object who's keys and values are the same by simply passing in the keys as arguments */
export const keyMirror = <Keys extends string[]>(...inputs: Keys) => {
  const mirrored = inputs.reduce((acc, key) => ({ ...acc, [key]: key }), {} as KeyMirror<Keys>)

  return Object.freeze(mirrored)
}
