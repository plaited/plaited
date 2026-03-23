#!/usr/bin/env bun

import { appendFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const ensureParentDir = async (path: string) => {
  const parentDir = dirname(path)
  if (parentDir && parentDir !== '.') {
    await Bun.$`mkdir -p ${parentDir}`.quiet()
  }
}

export const resetJsonlOutput = async (path: string) => {
  await ensureParentDir(path)
  await Bun.write(path, '')
}

export const appendJsonlRow = async (path: string, row: unknown) => {
  await appendFile(path, `${JSON.stringify(row)}\n`)
}

export const appendJsonlRows = async (path: string, rows: unknown[]) => {
  if (rows.length === 0) return
  await appendFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}
