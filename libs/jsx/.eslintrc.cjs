const config = require('../../.eslintrc.cjs')

module.exports = {
  ...config,
  rules: {
    ...config.rules,
    'max-len': 0,
    '@typescript-eslint/no-explicit-any': 0,
  },
}
