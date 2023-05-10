module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'jsx',
      'plaited',
      'rite',
      'utils',
      'playbook',
      'examples',
    ] ],
  },
}
