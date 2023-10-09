import {  PlaitedElement } from '@plaited/jsx'

export const elementRegister = new Map<string, PlaitedElement>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const register = <T extends Record<string, any> = Record<string, any>>(
  name: string,
  resultFn: PlaitedElement<T>
): PlaitedElement<T> => {
  elementRegister.set(name,  resultFn)
  return elementRegister.get(name)
}

