module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'islandly',
      'jsx',
      'rite',
      'token-schema',
      'token-transformer',
      'token-types',
      'utils',
    ] ],
  },
}
