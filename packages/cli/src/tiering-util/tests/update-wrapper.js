import path from 'path'
import { update } from '../../../dist/tiering-util/update.js'
import { fileURLToPath } from 'url'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const source = path.resolve(__dirname, '__mocks__/update/source/src')
export const target = path.resolve(__dirname, '__mocks__/update/target/src')

;(async () => {
  await update({ target, source, packageName: 'mock' })
})()
