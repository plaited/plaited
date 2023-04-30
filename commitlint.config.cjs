module.exports = {
  extends: [ '@commitlint/config-conventional' ],
  rules: {
    'scope-enum': [ 2, 'always', [
      'behavioral',
      'design-system-tools',
      'islandly',
      'jsx',
      'rite',
      'server',
      'utils',
    ] ],
  },
}
