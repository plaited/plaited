import { mkdir } from 'node:fs/promises'
import { Config } from './types.js'
import express, { Request, Response } from 'express'

export const workshop = async ({
  assets,
  tests = '.playwright',
  port = 3000,
  tokens,
  output = '.transformed',
  stories,
}: Config) => {
  const testDir = `${process.cwd()}/${tests}`
  await mkdir(testDir, { recursive: true })
  let transformedDir: string | undefined
  if(tokens) {
    transformedDir = `${process.cwd()}/${output}`
    await mkdir(transformedDir, { recursive: true })
  }
  const app = express()
}
