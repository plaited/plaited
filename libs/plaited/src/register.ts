import {  PlaitedElement } from '@plaited/jsx'

const elementRegister = new Map<string, PlaitedElement>

const notPascalCased = (str: string) => !/^[A-Z]\w*$/.test(str)

export const getElement = (name:string) => {
  // P1 improper name
  if(notPascalCased(name)) {
    console.error(`Element name MUST be PascalCased [${name}]`)
  }
  // P2 element not registered
  if(!elementRegister.has(name)) {
    console.error(`Element NOT registered [${name}]`)
  }
  // P3 we always return back the original string otherwise
  return elementRegister.get(name) ?? name
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const register = <T extends Record<string, any> = Record<string, any>>(
  name: string,
  resultFn: PlaitedElement<T>
): PlaitedElement<T> => {
  if(notPascalCased(name)) {
    throw Error(`Element name MUST be PascalCased [${name}]`)
  }
  if(elementRegister.has(name)) {
    console.error(`Element IS already registered [${name}]`)
  } else {
    elementRegister.set(name,  resultFn)
  }
  return elementRegister.get(name)
}

