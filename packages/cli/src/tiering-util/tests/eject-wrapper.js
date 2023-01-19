import path from 'path'
import { eject } from '../../../dist/tiering-util/eject.js'
import { fileURLToPath } from 'url'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const source = path.resolve(__dirname, '__mocks__/eject/source/src')
export const target = path.resolve(__dirname, '__mocks__/eject/target/src')

;(async () => {
  await eject({ target, source, packageName: 'mock' })
})()
