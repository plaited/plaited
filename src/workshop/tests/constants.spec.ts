import { expect, test } from 'bun:test'
import { TEMPLATE_FILE_REGEX, WORKER_FILE_REGEX, STORIES_GLOB_PATTERN } from '../workshop.constants.js'

test('TEMPLATE_FILE_REGEX', () => {
  expect(TEMPLATE_FILE_REGEX.test('/template.ts')).toBeTrue()
  expect(TEMPLATE_FILE_REGEX.test('/_components/template.tsx')).toBeFalse()
  expect(TEMPLATE_FILE_REGEX.test('/src/components/button/template.tsx')).toBeTrue()
  expect(TEMPLATE_FILE_REGEX.test('/src/_components/button/template.tsx')).toBeFalse()
})

test('TEMPLATE_FILE_REGEX', () => {
  expect(WORKER_FILE_REGEX.test('/worker.ts')).toBeTrue()
  expect(WORKER_FILE_REGEX.test('/_components/worker.tsx')).toBeFalse()
  expect(WORKER_FILE_REGEX.test('/src/components/button/worker.tsx')).toBeTrue()
  expect(WORKER_FILE_REGEX.test('/src/_components/button/worker.tsx')).toBeFalse()
})

test('STORIES_GLOB_PATTERN', () => {
  const glob = new Bun.Glob(STORIES_GLOB_PATTERN)
  expect(glob.match('/src/components/button/stories.tsx')).toBeTrue()
  expect(glob.match('/src/components/button/named.stories.tsx')).toBeTrue()
})
