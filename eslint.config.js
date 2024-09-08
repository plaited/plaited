import globals from 'globals'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

// @ts-ignore: valid rule
export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier, {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-ts-comment': [
      2,
      {
        'ts-ignore': 'allow-with-description',
      },
    ],
  },
})
