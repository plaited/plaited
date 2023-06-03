module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'examples',
      'jsx',
      'plaited',
      'playbook',
      'rite',
      'utils',
      'workshop',
    ] ],
  },
}
