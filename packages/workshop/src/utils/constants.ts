import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const registry = 'registry.js'
export const root = path.resolve(__dirname, '../workshop')
export const testExtension = '.playwright.spec.ts'
export const assetsDir = `${root}/public`
export const worksDir = `${root}/works`
export const worksDirectoryFile = `${root}/directory.js`
