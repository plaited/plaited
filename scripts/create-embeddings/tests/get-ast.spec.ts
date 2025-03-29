import { expect, test, describe } from 'bun:test'
import { getTypescriptAst } from '../get-typescript-ast'

describe('getTypescriptAst', () => {
  test('should correctly parse and print TypeScript source code', () => {
    // Arrange
    const path = 'test.ts'
    const source = `
      function hello(name: string): string {
        return \`Hello, \${name}!\`;
      }
    `
    // Act
    const result = getTypescriptAst(path, source)
    // Assert
    expect(result).toMatchSnapshot()
  })

  test('should handle empty source code', () => {
    // Arrange
    const path = 'empty.ts'
    const source = ''
    // Act
    const result = getTypescriptAst(path, source)
    // Assert
    expect(result).toMatchSnapshot()
  })

  test('should preserve complex TypeScript syntax', () => {
    // Arrange
    const path = 'complex.ts'
    const source = `
      interface User {
        name: string;
        age: number;
      }

      class UserService {
        private users: User[] = [];

        public addUser(user: User): void {
          this.users.push(user);
        }
      }
    `

    // Act
    const result = getTypescriptAst(path, source)
    // Assert
    expect(result).toMatchSnapshot()
  })
})
