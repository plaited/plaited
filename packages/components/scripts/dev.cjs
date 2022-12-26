const cp = require('child_process')
const chokidar = require('chokidar')

const run = scriptName => cp.spawn('yarn', [ scriptName ], { stdio: 'inherit' })

run('build:css-types')

chokidar.watch('src/**/*.module.css').on('change', () => {
  run('build:css-types')
})
