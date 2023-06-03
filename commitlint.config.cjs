module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'examples',
      'jsx',
      'modnet',
      'on-braid',
      'plaited',
      'playbook',
      'rite',
      'token-schema',
      'token-transformer',
      'token-types',
      'utils',
      'workshop',
    ] ],
  },
}
