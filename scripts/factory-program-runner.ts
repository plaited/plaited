#!/usr/bin/env bun

import { programRunnerCli } from '../src/cli/program-runner/program-runner-cli.ts'

await programRunnerCli(Bun.argv.slice(2))
