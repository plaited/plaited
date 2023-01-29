/**
 * Fork of https://github.com/ewnd9/inquirer-test with some new key options and updated to
 * support newer node version
 */
import { spawn } from 'child_process'
//@ts-ignore: not wasting time typing this classic package
import concat from 'concat-stream'

export const run = (args:string[], combo: string[], timeout = 200) => {

  const proc = spawn('node', args, { stdio: [ null, null, null ] })

  const loop = (combo: string[]) => {
    if (combo.length > 0) {
      setTimeout(() => {
        proc.stdin?.write(combo[0])
        loop(combo.slice(1))
      }, timeout)
    } else {
      proc.stdin?.end()
    }
  }

  loop(combo)
  return new Promise(resolve =>{
    //@ts-ignore: test
    proc.stdout?.pipe(concat((result:string[]) =>{
      resolve(result.toString())
    }))
  })
}

export const DOWN = '\x1B\x5B\x42'
export const UP = '\x1B\x5B\x41'
export const ENTER = '\x0D'
export const SPACE = '\x20'
