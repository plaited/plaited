import { expect, test } from 'bun:test'
import { WORKER_FILTER_REGEX, TEMPLATE_FILTER_REGEX } from '../workshop.constants.js'

test('TEMPLATE_FILTER_REGEX', () => {
  expect(TEMPLATE_FILTER_REGEX.test('/template.tsx')).toBeTrue()
  expect(TEMPLATE_FILTER_REGEX.test('/dir/sub/template.tsx')).toBeTrue()
  expect(TEMPLATE_FILTER_REGEX.test('/dir/sub/template.ts')).toBeTrue()
  expect(TEMPLATE_FILTER_REGEX.test('/dir/_sub/template.ts')).toBeFalse()
  expect(TEMPLATE_FILTER_REGEX.test('/dir/_sub/button/template.tsx')).toBeFalse()
})

test('WORKER_FILTER_REGEX', () => {
  expect(WORKER_FILTER_REGEX.test('/worker.ts')).toBeTrue()
  expect(WORKER_FILTER_REGEX.test('/dir/sub/worker.ts')).toBeTrue()
  expect(WORKER_FILTER_REGEX.test('/dir/sub/worker.tsx')).toBeFalse()
  expect(WORKER_FILTER_REGEX.test('/dir/_sub/worker.ts')).toBeFalse()
})
