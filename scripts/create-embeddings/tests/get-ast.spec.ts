import { expect, test, describe } from 'bun:test'
import { getAst } from '../get-typescript-ast'

describe('getAst', () => {
  test('should correctly parse and print TypeScript source code', () => {
    // Arrange
    const path = 'test.ts'
    const source = `
      function hello(name: string): string {
        return \`Hello, \${name}!\`;
      }
    `
    // Act
    const result = getAst(path, source)
    // Assert
    expect(result).toMatchSnapshot()
  })

  test('should handle empty source code', () => {
    // Arrange
    const path = 'empty.ts'
    const source = ''
    // Act
    const result = getAst(path, source)
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
    const result = getAst(path, source)
    // Assert
    expect(result).toMatchSnapshot()
  })
})
