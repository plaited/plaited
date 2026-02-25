#!/usr/bin/env bun
/**
 * Scaffold development rules into AGENTS.md
 *
 * Writes rules into AGENTS.md (creates if missing, uses markers for updates).
 * Adds `@AGENTS.md` reference to CLAUDE.md if it exists without one.
 *
 * @throws When source rules directory cannot be read
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

/** Markers for the rules section in AGENTS.md */
const RULES_START = '<!-- PLAITED-RULES-START -->'
const RULES_END = '<!-- PLAITED-RULES-END -->'

/**
 * Main scaffold-rules function
 */
export const scaffoldRules = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      list: { type: 'boolean', short: 'l' },
      'dry-run': { type: 'boolean', short: 'n' },
    },
    allowPositionals: true,
    strict: false,
  })

  const dryRun = values['dry-run'] as boolean | undefined
  const listOnly = values.list as boolean | undefined

  const sourceRules = join(import.meta.dir, '../rules')
  const cwd = process.cwd()

  // Get available rules
  const files = await readdir(sourceRules)
  const rules = files.filter((f) => f.endsWith('.md'))

  // --list: just output available rules
  if (listOnly) {
    console.log(JSON.stringify({ rules: rules.map((f) => f.replace('.md', '')) }))
    return
  }

  const actions: string[] = []

  // 1. Write rules into AGENTS.md
  const agentsMdPath = join(cwd, 'AGENTS.md')
  const agentsMd = Bun.file(agentsMdPath)

  const ruleEntries: string[] = []
  for (const file of rules) {
    const content = await Bun.file(join(sourceRules, file)).text()
    ruleEntries.push(content)
  }
  const rulesContent = ruleEntries.join('\n\n')
  const rulesSection = `${RULES_START}\n\n## Rules\n\n${rulesContent}\n\n${RULES_END}`

  if (await agentsMd.exists()) {
    const content = await agentsMd.text()
    const startIdx = content.indexOf(RULES_START)
    const endIdx = content.indexOf(RULES_END)

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const before = content.slice(0, startIdx)
      const after = content.slice(endIdx + RULES_END.length)
      if (!dryRun) {
        await Bun.write(agentsMdPath, `${before}${rulesSection}${after}`)
      }
      actions.push('update: AGENTS.md (rules section)')
    } else {
      if (!dryRun) {
        await Bun.write(agentsMdPath, `${content}\n${rulesSection}\n`)
      }
      actions.push('append: AGENTS.md (rules section)')
    }
  } else {
    if (!dryRun) {
      await Bun.write(agentsMdPath, `# AGENTS\n\n${rulesSection}\n`)
    }
    actions.push('create: AGENTS.md (rules section)')
  }

  // 2. Add @AGENTS.md reference to CLAUDE.md if it exists without one
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  const claudeMd = Bun.file(claudeMdPath)

  if (await claudeMd.exists()) {
    const content = await claudeMd.text()
    if (/^@AGENTS\.md/m.test(content)) {
      actions.push('skip: CLAUDE.md (already references @AGENTS.md)')
    } else {
      if (!dryRun) {
        await Bun.write(claudeMdPath, `@AGENTS.md\n\n${content}`)
      }
      actions.push('update: CLAUDE.md (added @AGENTS.md reference)')
    }
  }

  console.log(JSON.stringify({ dryRun: !!dryRun, actions }, null, 2))
}

// CLI entry point
if (import.meta.main) {
  await scaffoldRules(Bun.argv.slice(2))
}
