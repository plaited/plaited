export const transpiler = new Bun.Transpiler({
  loader: 'tsx',
  tsconfig: JSON.stringify({
    compilerOptions: {
      jsx: 'react-jsx',
      jsxFactory: 'h',
      jsxFragmentFactory: 'Fragment',
      jsxImportSource: 'plaited',
    },
  }),
})
