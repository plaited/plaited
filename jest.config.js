export default {
  transformIgnorePatterns:[],
  transform: {
    '^.+\\.(t|j)sx?$':  [
      '@swc/jest',
      {
        jsc: {
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
 
