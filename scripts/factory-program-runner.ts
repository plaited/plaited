#!/usr/bin/env bun

import { programRunnerCli } from '../src/program-runner.ts'

await programRunnerCli(Bun.argv.slice(2))
