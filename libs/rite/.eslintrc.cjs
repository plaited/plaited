const config = require('../../.eslintrc.cjs')

module.exports = {
  ...config,
  rules: {
    ...config.rules,
    'no-console': 0,
  },
}
