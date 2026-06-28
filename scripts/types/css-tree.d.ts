declare module 'css-tree' {
  export const definitionSyntax: {
    parse(syntax: string): Record<string, unknown>
  }
}