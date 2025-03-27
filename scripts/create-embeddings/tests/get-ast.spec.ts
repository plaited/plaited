import { expect, test, describe } from 'bun:test'
import { getAst } from '../get-ast'

describe('getAst', () => {
  test('should correctly parse simple variable declaration', () => {
    const source = `const x = 5;`
    const result = getAst(source, 'test.ts')

    expect(result.kind).toBe('SourceFile')
    expect(result.text).toBe('const x = 5;')

    const syntaxList = result.children?.find((child) => child.kind === 'SyntaxList')
    expect(syntaxList).toBeDefined()

    const varDecList = syntaxList?.children?.[0]?.children?.find((child) => child.kind === 'VariableDeclarationList')
    expect(varDecList).toBeDefined()
    expect(varDecList?.text).toInclude('const x = 5')
  })

  test('should correctly parse function declaration', () => {
    const source = `function test() {
      return true;
    }`
    const result = getAst(source, 'test.ts')

    expect(result.kind).toBe('SourceFile')
    const syntaxList = result.children?.find((child) => child.kind === 'SyntaxList')
    const funcDecl = syntaxList?.children?.[0]
    expect(funcDecl?.kind).toBe('FunctionDeclaration')
    expect(funcDecl?.text).toInclude('function test')
  })

  test('should handle multiple statements', () => {
    const source = `const a = 1;
    let b = 2;
    var c = 3;`
    const result = getAst(source, 'test.ts')

    const syntaxList = result.children?.find((child) => child.kind === 'SyntaxList')
    const statements = syntaxList?.children

    expect(statements?.length).toBe(3)
    expect(statements?.[0].text).toInclude('const a = 1')
    expect(statements?.[1].text).toInclude('let b = 2')
    expect(statements?.[2].text).toInclude('var c = 3')
  })

  test('should handle empty source', () => {
    const source = ''
    const result = getAst(source, 'test.ts')

    expect(result.kind).toBe('SourceFile')
    expect(result.text).toBe('')
    expect(result.children).toBeArray()
  })

  test('should maintain proper node hierarchy', () => {
    const source = `if (true) {
      console.log("test");
    }`
    const result = getAst(source, 'test.ts')

    expect(result.kind).toBe('SourceFile')
    const syntaxList = result.children?.find((child) => child.kind === 'SyntaxList')
    const ifStatement = syntaxList?.children?.[0]
    expect(ifStatement?.kind).toBe('IfStatement')

    const block = ifStatement?.children?.find((child) => child.kind === 'Block')
    expect(block).toBeDefined()
  })

  // Helper test to visualize the AST structure
  test.skip('debug: show AST structure', () => {
    const source = `const x = 5;`
    const result = getAst(source, 'test.ts')
    console.log(JSON.stringify(result, null, 2))
  })
})
