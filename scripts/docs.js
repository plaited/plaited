import cp from 'child_process'
import fs from 'fs/promises'

const cwd = process.cwd()

await fs.rm(`${cwd}/playbook/libraries`, { recursive: true })

await (()  =>{
  return new Promise((resolve, reject) => {
    const child = cp.spawn('bun', [ 'typedoc',  '--plugin', 'typedoc-plugin-markdown' ])

    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Child process exited with code ${code}`))
      }
    })

    child.on('error', err => {
      reject(err)
    })
  })
})()

const files = [
  `${cwd}/playbook/libraries/README.md`,
  `${cwd}/playbook/libraries/modules.md`,
]

await Promise.all(files.map(async file => fs.rm(file, { recursive: true })))
