export type WorkerWriteResponse = {
  planId: string
  ok: boolean
  cwd: string
  path: string
  encoding: 'utf8' | 'base64'
  bytes: number
}

export type WorkerReadResponse = {
  planId: string
  cwd: string
  ok: boolean
  path: string
  encoding: 'utf8' | 'bytes'
  content: string
  bytes: number
  truncated: boolean
}

export type WorkerShellResponse = {
  planId: string
  cwd: string
  ok: boolean
  exitCode: number
  signalCode: null
  stdout: string
  stderr: string
  stdoutBytes: number
  stderrBytes: number
  stdoutTruncated: boolean
  stderrTruncated: boolean
  stdoutPath: null
  stderrPath: null
  durationMs: number
  timedOut: boolean
}

export type WorkerUpdateSpecsResponse = {
  planId: string
  ok: boolean
}
