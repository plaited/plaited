import { deepEqual } from '../utils/deep-equal.ts'
import { sourceMap } from './deps.ts'

export type Assertion = <T extends unknown>(param: {
  given: string
  should: string
  actual: T
  expected: T
}) => void

const requiredKeys = ['given', 'should', 'actual', 'expected']

const concatToString = (keys: string, key: string, index: number) =>
  keys + (index ? ', ' : '') + key

const getStackTrace = () => {
  const err = new Error()
  const stack = (err.stack || '').split('\n')
  stack.splice(0, 2)
  for (const frame of stack) {
    const match = frame.match(/\(([^)]+)\)/)
    if (match) {
      const [_, location] = match
      const [file, line] = location.split(':')
      console.log({ file, line })
      return { file, line: Number(line) }
    }
  }
  return {}
}

const getOriginalPosition = async (file: string, line: number) => {
  const response = await fetch(`${file}.map`)
  const rawSourceMap = await response.json()
  const consumer = await new sourceMap.SourceMapConsumer(rawSourceMap)
  const { source, ...rest } = consumer.originalPositionFor({
    line,
    column: 0,
  })
  let originalFile: string | undefined = undefined
  let originalLine: number | undefined | null = undefined
  if (source) {
    originalFile = source
    originalLine = rest.line
  }
  consumer.destroy()
  return { originalFile, originalLine }
}

export const assert: Assertion = async (param) => {
  const args = param ?? {} as unknown as Parameters<Assertion>[0]
  const missing = requiredKeys.filter(
    (k) => !Object.keys(args).includes(k),
  )
  if (missing.length) {
    throw new Error(
      `The following parameters are required by \`assert\`: ${
        missing.reduce(concatToString, '')
      }`,
    )
  }

  const {
    given = undefined,
    should = '',
    actual = undefined,
    expected = undefined,
  } = args
  if (!deepEqual(actual, expected)) {
    let { file, line } = getStackTrace()
    console.log({ file, line })
    if (file && line) {
      const { originalFile, originalLine } = await getOriginalPosition(
        file,
        line,
      )
      line = originalLine || line
      file = originalFile || file
    }
    const message = `Given ${given}: should ${should} ${file}:${line}`
    throw new Error(message)
  }
}
