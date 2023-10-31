module.exports = {
  ignorePatterns: ['**/dist/*'],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:compat/recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  overrides: [
    {
      files: ['**/*.spec.*'],
      rules: {
        'func-names': 0,
        'no-console': 0,
        'no-shadow': 0,
        'no-return-assign': 0,
        'no-global-assign': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
      },
    },
    {
      files: ['**/*.svg.tsx'],
      rules: {
        'max-len': 0,
      },
    },
    {
      files: ['**/*.cjs'],
      rules: {
        '@typescript-eslint/no-var-requires': 0,
        'no-undef': 0,
        'func-names': 0,
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowImportExportEverywhere: true,
  },
  plugins: ['@typescript-eslint'],
  root: true,
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-ts-comment': [
      2,
      {
        'ts-ignore': 'allow-with-description',
      },
    ],
  },
}
