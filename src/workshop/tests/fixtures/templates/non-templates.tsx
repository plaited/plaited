// This file contains exports that should NOT be detected as templates

export function regularFunction() {
  return 'Just a regular string'
}

export const regularConst = 'Just a constant'

export const objectLiteral = {
  name: 'test',
  value: 42,
}

export class RegularClass {
  method() {
    return 'class method'
  }
}

export const arrowFunction = () => {
  console.log('Not a template')
}
