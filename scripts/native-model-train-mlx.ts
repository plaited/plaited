/**
 * Bun-native wrapper for the MLX LoRA training backend.
 *
 * @remarks
 * Keeps the top-level operator surface Bun-first while delegating the actual
 * training implementation to the uv-managed Python subproject under
 * `dev-research/native-model/training/`.
 *
 * @packageDocumentation
 */

import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parseArgs as parseTrainingArgs, prepareTrainingRun } from './native-model-train.ts'

const TRAINING_DIR = `${import.meta.dir}/../dev-research/native-model/training`
const TRAINING_SCRIPT = 'train_mlx_lora.py'
const DEFAULT_OUTPUT_DIR = './dev-research/native-model/training/runs/bootstrap-mlx'
const UV_CACHE_DIR = `${TRAINING_DIR}/.uv-cache`

const createTimestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const ensureTrainingProject = async (): Promise<void> => {
  const pyproject = Bun.file(`${TRAINING_DIR}/pyproject.toml`)
  if (!(await pyproject.exists())) {
    throw new Error(`Training project not found: ${TRAINING_DIR}`)
  }
}

const ensureUv = (): void => {
  if (!Bun.which('uv')) {
    throw new Error('uv is not installed or not on PATH')
  }
}

type MlxConfig = {
  outputDir: string
  forwardArgs: string[]
  shapeMaxExampleTokens?: number
  maxSeqLength?: number
}

const parseMlxArgs = (args: string[]): MlxConfig => {
  let outputDir = process.env.NATIVE_MODEL_TRAIN_OUTPUT_DIR ?? `${DEFAULT_OUTPUT_DIR}-${createTimestamp()}`
  const forwardArgs: string[] = []
  let shapeMaxExampleTokens: number | undefined
  let maxSeqLength: number | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) {
      continue
    }

    switch (arg) {
      case '--output-dir':
        {
          const nextOutputDir = args[index + 1]
          if (nextOutputDir) {
            outputDir = nextOutputDir
          }
        }
        index += 1
        break
      case '--max-seq-length':
        {
          const nextMaxSeqLength = args[index + 1]
          if (nextMaxSeqLength) {
            maxSeqLength = Number(nextMaxSeqLength)
          }
          forwardArgs.push(arg)
          if (nextMaxSeqLength) {
            forwardArgs.push(nextMaxSeqLength)
          }
        }
        index += 1
        break
      case '--max-example-tokens':
        {
          const nextShapeMaxExampleTokens = args[index + 1]
          if (nextShapeMaxExampleTokens) {
            shapeMaxExampleTokens = Number(nextShapeMaxExampleTokens)
          }
        }
        index += 1
        break
      default:
        forwardArgs.push(arg)
        break
    }
  }

  return {
    outputDir: outputDir.replace(/\/$/, ''),
    forwardArgs,
    ...(typeof shapeMaxExampleTokens === 'number' && Number.isFinite(shapeMaxExampleTokens)
      ? { shapeMaxExampleTokens }
      : {}),
    ...(typeof maxSeqLength === 'number' && Number.isFinite(maxSeqLength) ? { maxSeqLength } : {}),
  }
}

const buildArgs = ({
  datasetPath,
  outputDir,
  forwardArgs,
}: {
  datasetPath: string
  outputDir: string
  forwardArgs: string[]
}): string[] => [
  'run',
  'python',
  TRAINING_SCRIPT,
  '--input',
  resolve(datasetPath),
  '--output-dir',
  resolve(outputDir),
  ...forwardArgs,
]

const run = async (): Promise<void> => {
  ensureUv()
  await ensureTrainingProject()

  const { outputDir, forwardArgs, shapeMaxExampleTokens, maxSeqLength } = parseMlxArgs(process.argv.slice(2))
  const prepArgs = ['--output-dir', outputDir]
  const effectiveShapeMaxExampleTokens = shapeMaxExampleTokens ?? maxSeqLength
  if (typeof effectiveShapeMaxExampleTokens === 'number') {
    prepArgs.push('--max-example-tokens', String(effectiveShapeMaxExampleTokens))
  }
  const prepConfig = parseTrainingArgs(prepArgs)
  await mkdir(prepConfig.outputDir, { recursive: true })
  await prepareTrainingRun(prepConfig)

  const args = buildArgs({
    datasetPath: prepConfig.datasetPath,
    outputDir: prepConfig.outputDir,
    forwardArgs,
  })
  await Bun.write(`${UV_CACHE_DIR}/.gitkeep`, '')
  const result = await Bun.$`uv ${args}`
    .cwd(TRAINING_DIR)
    .env({
      ...(process.env as Record<string, string>),
      UV_CACHE_DIR,
    })
    .nothrow()

  const exitCode = result.exitCode
  if (exitCode !== 0) {
    throw new Error(`MLX training wrapper failed with exit code ${exitCode}`)
  }
}

await run()
