/**
 * source https://levelup.gitconnected.com/how-to-get-a-perfect-deep-equal-in-javascript-b849fe30e54f
 */

export const deepEqual = (objA: unknown, objB: unknown, map = new WeakMap()) => {
  // P1
  if (Object.is(objA, objB)) return true

  // P2
  if (objA instanceof Date && objB instanceof Date) {
    return objA.getTime() === objB.getTime()
  }
  if (objA instanceof RegExp && objB instanceof RegExp) {
    return objA.toString() === objB.toString()
  }

  // P3
  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false
  }

  // P4
  if (map.get(objA) === objB) return true
  map.set(objA, objB)

  // P5
  const keysA = Reflect.ownKeys(objA)
  const keysB = Reflect.ownKeys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (let i = 0; i < keysA.length; i++) {
    if (
      !Reflect.has(objB, keysA[i]) ||
      !deepEqual(objA[keysA[i] as keyof typeof objA], objB[keysA[i] as keyof typeof objB], map)
    ) {
      return false
    }
  }

  return true
}
