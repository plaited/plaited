export default {
  transformIgnorePatterns:[],
  transform: {
    '^.+\\.(t|j)sx?$':  [
      '@swc/jest',
      {
        jsc: {
          parser: {
            jsx: true,
          },
          transform: {
            react: {
              importSource: '@plaited/jsx',
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
