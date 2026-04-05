#!/usr/bin/env bun

import { resolve } from 'node:path'
import { DefaultResourceLoader, getAgentDir } from '@mariozechner/pi-coding-agent'

type ProbeInput = {
  cwd?: string
}

const parseInput = async (): Promise<ProbeInput> => {
  const arg = Bun.argv[2]
  if (arg) {
    return JSON.parse(arg) as ProbeInput
  }

  const stdin = await Bun.stdin.text()
  return stdin.trim() ? (JSON.parse(stdin) as ProbeInput) : {}
}

const main = async () => {
  const input = await parseInput()
  const cwd = resolve(input.cwd ?? process.cwd())
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir: getAgentDir(),
  })
  await loader.reload()

  const agents = loader.getAgentsFiles().agentsFiles.map((file) => file.path)
  const skills = loader.getSkills().skills.map((skill) => ({
    name: skill.name,
    path: skill.filePath,
  }))
  const extensions = loader.getExtensions().extensions.map((extension) => extension.path)

  console.log(
    JSON.stringify(
      {
        cwd,
        agents,
        skills,
        extensions,
        skillCount: skills.length,
        extensionCount: extensions.length,
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  await main()
}
