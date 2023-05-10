module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'jsx',
      'plaited',
      'rite',
      'token-schema',
      'token-transformer',
      'token-types',
      'utils',
      'playbook',
      'examples',
    ] ],
  },
}
