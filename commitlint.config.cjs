module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'comms',
      'component',
      'examples',
      'jsx',
      'plaited',
      'playbook',
      'token-schema',
      'token-transformer',
      'token-types',
      'utils',
    ] ],
  },
}
