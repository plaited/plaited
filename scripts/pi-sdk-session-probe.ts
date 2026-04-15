#!/usr/bin/env bun

import { resolve } from 'node:path'
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'

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
  const agentDir = getAgentDir()
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
  })
  await resourceLoader.reload()

  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
  const { session, extensionsResult, modelFallbackMessage } = await createAgentSession({
    cwd,
    agentDir,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    authStorage,
    modelRegistry,
  })

  const result = {
    cwd,
    sessionId: session.sessionId,
    sessionFile: session.sessionFile ?? null,
    model: session.model ? `${session.model.provider}/${session.model.id}` : null,
    thinkingLevel: session.thinkingLevel,
    agents: resourceLoader.getAgentsFiles().agentsFiles.map((file) => file.path),
    skills: resourceLoader.getSkills().skills.map((skill) => ({
      name: skill.name,
      path: skill.filePath,
    })),
    extensions: extensionsResult.extensions.map((extension) => extension.path),
    extensionErrors: extensionsResult.errors,
    modelFallbackMessage: modelFallbackMessage ?? null,
  }

  session.dispose()
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.main) {
  await main()
}
