import test from 'ava'
import { ejectTemplate, reExportTemplate } from '../templates.js'

test('ejectTemplate()',  t => {
  t.is(ejectTemplate('button'), `export * from './button'`)
})

test('reExportTemplate()',  t => {
  t.is(reExportTemplate('button', 'mock'), `export * from 'mock/src/button'`)
})
