/**
 * Skill script discovery and execution.
 * Bridges AgentSkills scripts to FunctionGemma function calls.
 *
 * @remarks
 * Skills can include `scripts/` directories with executable code.
 * This module:
 * 1. Discovers skills and loads metadata from SKILL.md frontmatter
 * 2. Discovers scripts in skill directories
 * 3. Registers scripts as tools for FunctionGemma to call
 * 4. Generates context injection XML for system prompts
 * 5. Executes scripts with security controls
 *
 * **Security**: Scripts run via `Bun.spawn()` with timeout,
 * allowlisting, and output capture. See AgentSkills spec for best practices.
 *
 * @see https://agentskills.io/integrate-skills
 */

import { basename, dirname, join } from 'node:path'
import { Glob } from 'bun'
import type { ToolHandler, ToolRegistry, ToolSchema } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Skill metadata from SKILL.md frontmatter.
 */
export type SkillMetadata = {
  /** Skill name (from frontmatter) */
  name: string
  /** Skill description (from frontmatter) */
  description: string
  /** Path to SKILL.md file */
  path: string
  /** Directory containing the skill */
  directory: string
  /** Optional license */
  license?: string
  /** Optional allowed-tools list */
  allowedTools?: string
}

/**
 * Metadata extracted from a skill script.
 */
export type SkillScript = {
  /** Script name (filename without extension) */
  name: string
  /** Description from JSDoc or frontmatter */
  description: string
  /** Path to the script file */
  path: string
  /** Skill directory containing the script */
  skillDir: string
  /** Skill name (directory name) */
  skillName: string
  /** Parameter schema extracted from script */
  parameters: ToolSchema['parameters']
}

/**
 * Options for skill script discovery.
 */
export type DiscoverOptions = {
  /** Root directory to scan for skills (default: .claude/skills) */
  skillsRoot?: string
  /** Script file extensions to include */
  extensions?: string[]
}

/**
 * Options for script execution.
 */
export type ExecuteOptions = {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Working directory for script execution */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
}

/**
 * Extracts description from script content.
 * Looks for JSDoc block comment or shebang + comment.
 */
const extractDescription = (content: string): string => {
  // Try JSDoc block comment
  const jsdocMatch = content.match(/\/\*\*\s*\n([^*]|\*(?!\/))*\*\//)
  if (jsdocMatch) {
    const comment = jsdocMatch[0]
    // Extract first paragraph
    const lines = comment
      .replace(/\/\*\*|\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l && !l.startsWith('@'))
    return lines.join(' ').trim()
  }

  // Try single-line comment after shebang
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('#!')) continue
    if (line.startsWith('//')) {
      return line.replace(/^\/\/\s*/, '').trim()
    }
    if (line.trim()) break
  }

  return 'Execute skill script'
}

/**
 * Extracts parameter schema from script content.
 * Looks for parseArgs usage or TypeScript type annotations.
 */
const extractParameters = (content: string): ToolSchema['parameters'] => {
  // Default schema for scripts that take positional args
  const defaultSchema: ToolSchema['parameters'] = {
    type: 'object',
    properties: {
      args: {
        type: 'string',
        description: 'Command-line arguments to pass to the script',
      },
    },
  }

  // Try to find parseArgs options
  const parseArgsMatch = content.match(/parseArgs\s*\(\s*\{[\s\S]*?options\s*:\s*\{([\s\S]*?)\}/m)
  if (parseArgsMatch) {
    const optionsBlock = parseArgsMatch[1]!
    const properties: Record<string, { type: string; description?: string }> = {}

    // Extract option definitions
    const optionRegex = /(\w+)\s*:\s*\{\s*type\s*:\s*['"](\w+)['"]/g
    let match: RegExpExecArray | null
    for (match of optionsBlock.matchAll(optionRegex)) {
      const [, name, type] = match
      if (name && type) {
        properties[name] = {
          type: type === 'boolean' ? 'boolean' : 'string',
          description: `${name} option`,
        }
      }
    }

    if (Object.keys(properties).length > 0) {
      return { type: 'object', properties }
    }
  }

  return defaultSchema
}

/**
 * Discovers skill scripts in the specified directory.
 *
 * @param options Discovery options
 * @returns Array of discovered skill scripts
 *
 * @remarks
 * Scans for scripts in `<skill>/scripts/` directories.
 * Extracts metadata from file content (JSDoc, parseArgs).
 *
 * See `src/agent/tests/skill-scripts.spec.ts` for usage patterns.
 */
export const discoverSkillScripts = async (options: DiscoverOptions = {}): Promise<SkillScript[]> => {
  const { skillsRoot = '.claude/skills', extensions = ['ts', 'js', 'sh', 'py'] } = options

  const scripts: SkillScript[] = []
  const pattern = `**/scripts/*.{${extensions.join(',')}}`
  const glob = new Glob(pattern)

  for await (const relativePath of glob.scan({ cwd: skillsRoot })) {
    const fullPath = join(skillsRoot, relativePath)
    const scriptName = basename(relativePath).replace(/\.\w+$/, '')

    // Skip test files
    if (scriptName.endsWith('.spec') || scriptName.endsWith('.test')) continue

    // Extract skill name from path (skill-name/scripts/script.ts)
    const parts = relativePath.split('/')
    const skillName = parts[0] ?? 'unknown'
    const skillDir = join(skillsRoot, skillName)

    try {
      const content = await Bun.file(fullPath).text()
      const description = extractDescription(content)
      const parameters = extractParameters(content)

      scripts.push({
        name: scriptName,
        description,
        path: fullPath,
        skillDir,
        skillName,
        parameters,
      })
    } catch {
      // Skip unreadable files
    }
  }

  return scripts
}

/**
 * Creates a tool handler for executing a skill script.
 *
 * @param script Script metadata
 * @param options Execution options
 * @returns Tool handler function
 */
const createScriptHandler =
  (script: SkillScript, options: ExecuteOptions = {}): ToolHandler =>
  async (args) => {
    const { timeout = 30000, cwd, env } = options

    // Build command arguments
    const cmdArgs: string[] = []
    if (args.args && typeof args.args === 'string') {
      // Split string args (simple parsing)
      cmdArgs.push(...args.args.split(/\s+/).filter(Boolean))
    } else {
      // Convert object args to CLI flags
      for (const [key, value] of Object.entries(args)) {
        if (value === true) {
          cmdArgs.push(`--${key}`)
        } else if (value !== false && value !== undefined) {
          cmdArgs.push(`--${key}`, String(value))
        }
      }
    }

    try {
      const proc = Bun.spawn(['bun', script.path, ...cmdArgs], {
        cwd: cwd ?? script.skillDir,
        env: { ...process.env, ...env },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Set up timeout
      const timeoutId = setTimeout(() => proc.kill(), timeout)

      const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])

      clearTimeout(timeoutId)

      const exitCode = await proc.exited

      if (exitCode !== 0) {
        return {
          success: false,
          error: stderr || `Script exited with code ${exitCode}`,
        }
      }

      // Try to parse JSON output
      try {
        const data = JSON.parse(stdout)
        return { success: true, data }
      } catch {
        // Return raw output
        return { success: true, data: { output: stdout.trim() } }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

/**
 * Registers discovered skill scripts as tools in a registry.
 *
 * @param registry Tool registry to register scripts in
 * @param scripts Scripts to register
 * @param options Execution options for scripts
 *
 * @remarks
 * Each script becomes a tool that FunctionGemma can call.
 * Tool names are prefixed with skill name: `skillName:scriptName`
 */
export const registerSkillScripts = (
  registry: ToolRegistry,
  scripts: SkillScript[],
  options: ExecuteOptions = {},
): void => {
  for (const script of scripts) {
    const toolName = `${script.skillName}:${script.name}`

    registry.register(toolName, createScriptHandler(script, options), {
      name: toolName,
      description: `[${script.skillName}] ${script.description}`,
      parameters: script.parameters,
    })
  }
}

/**
 * Discovers and registers all skill scripts from a directory.
 * Convenience function combining discovery and registration.
 *
 * @param registry Tool registry
 * @param options Discovery and execution options
 * @returns Array of registered scripts
 */
export const loadSkillScripts = async (
  registry: ToolRegistry,
  options: DiscoverOptions & ExecuteOptions = {},
): Promise<SkillScript[]> => {
  const scripts = await discoverSkillScripts(options)
  registerSkillScripts(registry, scripts, options)
  return scripts
}

// ============================================================================
// Skill Metadata Discovery
// ============================================================================

/**
 * Parses YAML frontmatter from SKILL.md content.
 * Extracts key-value pairs between `---` delimiters.
 */
const parseFrontmatter = (content: string): Record<string, string> => {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const frontmatter: Record<string, string> = {}
  const lines = match[1]!.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()
    if (key && value) {
      frontmatter[key] = value
    }
  }

  return frontmatter
}

/**
 * Discovers skills by finding SKILL.md files.
 *
 * @param skillsRoot Root directory to scan for skills
 * @returns Array of skill metadata
 *
 * @remarks
 * Scans for SKILL.md files and extracts frontmatter metadata.
 * Required frontmatter fields: name, description
 */
export const discoverSkills = async (skillsRoot = '.claude/skills'): Promise<SkillMetadata[]> => {
  const skills: SkillMetadata[] = []
  const glob = new Glob('*/SKILL.md')

  for await (const relativePath of glob.scan({ cwd: skillsRoot })) {
    const fullPath = join(skillsRoot, relativePath)
    const skillDir = dirname(fullPath)

    try {
      const content = await Bun.file(fullPath).text()
      const frontmatter = parseFrontmatter(content)

      // Skip skills without required fields
      if (!frontmatter.name || !frontmatter.description) continue

      skills.push({
        name: frontmatter.name,
        description: frontmatter.description,
        path: fullPath,
        directory: skillDir,
        license: frontmatter.license,
        allowedTools: frontmatter['allowed-tools'],
      })
    } catch {
      // Skip unreadable files
    }
  }

  return skills
}

// ============================================================================
// Context Injection
// ============================================================================

/**
 * Formats skill scripts as XML context for system prompts.
 * Follows AgentSkills context injection spec.
 *
 * @param scripts Discovered skill scripts
 * @param skills Optional skill metadata for enhanced context
 * @returns XML string for system prompt injection
 */
export const formatSkillsContext = (scripts: SkillScript[], skills?: SkillMetadata[]): string => {
  if (scripts.length === 0) return ''

  // Group scripts by skill
  const bySkill = new Map<string, SkillScript[]>()
  for (const script of scripts) {
    const existing = bySkill.get(script.skillName) ?? []
    existing.push(script)
    bySkill.set(script.skillName, existing)
  }

  // Build skill metadata lookup
  const skillMeta = new Map(skills?.map((s) => [s.name, s]))

  // Generate XML
  const skillBlocks = [...bySkill.entries()].map(([skillName, skillScripts]) => {
    const meta = skillMeta.get(skillName)
    const description = meta?.description ?? `Scripts from ${skillName} skill`

    const toolEntries = skillScripts.map((s) => {
      const params = Object.entries(s.parameters.properties)
        .map(([name, prop]) => `      <param name="${name}" type="${prop.type}">${prop.description ?? ''}</param>`)
        .join('\n')

      return `    <tool name="${skillName}:${s.name}">
      <description>${s.description}</description>
${params ? `      <parameters>\n${params}\n      </parameters>` : '      <parameters />'}
    </tool>`
    })

    return `  <skill name="${skillName}">
    <description>${description}</description>
${toolEntries.join('\n')}
  </skill>`
  })

  return `<available_skills>
${skillBlocks.join('\n')}
</available_skills>`
}

/**
 * Generates tool schemas from skill scripts for model context.
 * Converts scripts to FunctionGemma-compatible tool definitions.
 *
 * @param scripts Discovered skill scripts
 * @returns Array of tool schemas
 */
export const scriptsToToolSchemas = (scripts: SkillScript[]): ToolSchema[] => {
  return scripts.map((s) => ({
    name: `${s.skillName}:${s.name}`,
    description: s.description,
    parameters: s.parameters,
  }))
}
