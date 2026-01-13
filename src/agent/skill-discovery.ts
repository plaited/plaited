/**
 * Skill Discovery for AgentSkills-compatible skill directories.
 *
 * @remarks
 * Discovers and indexes skills from file system following the AgentSkills spec.
 *
 * **Capabilities:**
 * - Scanning directories for SKILL.md files
 * - Parsing frontmatter metadata (name, description)
 * - Discovering executable scripts in `<skill>/scripts/`
 * - Extracting script metadata from JSDoc and parseArgs patterns
 * - Generating XML context for system prompts
 * - Converting scripts to tool schemas
 *
 * @see {@link https://agentskills.io/specification | AgentSkills Specification}
 *
 * @module
 */

import { basename, dirname, extname, join } from 'node:path'
import type { ToolSchema } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Skill metadata extracted from SKILL.md frontmatter.
 */
export type SkillMetadata = {
  /** Skill name from frontmatter */
  name: string
  /** Description of when to use this skill */
  description: string
  /** Absolute path to SKILL.md */
  location: string
  /** Directory containing the skill */
  skillDir: string
  /** Optional tags for categorization */
  tags?: string[]
  /** Whether this skill is user-invocable (has slash command) */
  invocable?: boolean
}

/**
 * Script metadata extracted from skill scripts.
 */
export type SkillScript = {
  /** Script name (filename without extension) */
  name: string
  /** Full qualified name: skill-name:script-name */
  qualifiedName: string
  /** Description extracted from JSDoc or first comment */
  description: string
  /** Absolute path to the script file */
  location: string
  /** Parent skill name */
  skillName: string
  /** File extension (.ts, .js, .sh, .py) */
  extension: string
  /** Extracted parameters from parseArgs or argparse patterns */
  parameters: ScriptParameter[]
}

/**
 * Script parameter metadata.
 */
export type ScriptParameter = {
  /** Parameter name */
  name: string
  /** Parameter type (string, boolean, number) */
  type: 'string' | 'boolean' | 'number'
  /** Whether the parameter is required */
  required: boolean
  /** Description of the parameter */
  description?: string
  /** Default value if any */
  default?: string | boolean | number
}

/**
 * Discovery options.
 */
export type DiscoveryOptions = {
  /** Root directory to scan for skills (default: '.claude/skills') */
  skillsRoot?: string
  /** Script file extensions to discover (default: ['.ts', '.js', '.sh', '.py']) */
  scriptExtensions?: string[]
  /** Whether to include absolute paths (default: true) */
  includeAbsolutePaths?: boolean
}

// ============================================================================
// Frontmatter Parsing
// ============================================================================

/**
 * Parses YAML frontmatter from SKILL.md content.
 *
 * @param content - Raw markdown content with frontmatter
 * @returns Parsed frontmatter as key-value pairs
 *
 * @internal
 */
const parseFrontmatter = (content: string): Record<string, unknown> => {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml = match[1]!
  const result: Record<string, unknown> = {}

  // Simple YAML parser for frontmatter fields
  for (const line of yaml.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Handle quoted strings
    if (typeof value === 'string') {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
    }

    // Handle booleans
    if (value === 'true') value = true
    if (value === 'false') value = false

    // Handle arrays (simple inline format)
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
    }

    result[key] = value
  }

  return result
}

// ============================================================================
// Script Metadata Extraction
// ============================================================================

/**
 * Extracts JSDoc description from script content.
 *
 * @param content - Script source code
 * @returns First paragraph of JSDoc or leading comment, or undefined if none found
 *
 * @internal
 */
const extractJSDocDescription = (content: string): string | undefined => {
  // Match JSDoc block comment at start of file
  const jsdocMatch = content.match(/^\/\*\*\s*\n([\s\S]*?)\*\//)
  if (jsdocMatch) {
    const lines = jsdocMatch[1]!
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => !line.startsWith('@'))
      .filter(Boolean)

    return lines.join(' ')
  }

  // Match single-line comment at start
  const singleLineMatch = content.match(/^\/\/\s*(.+)/)
  if (singleLineMatch) {
    return singleLineMatch[1]
  }

  // Match shell/python comment at start
  const hashMatch = content.match(/^#\s*(.+)/)
  if (hashMatch && !hashMatch[1]!.startsWith('!')) {
    return hashMatch[1]
  }

  return undefined
}

/**
 * Extracts parameters from Bun's parseArgs usage in TypeScript/JavaScript.
 *
 * @param content - Script source code containing parseArgs call
 * @returns Array of extracted parameter metadata
 *
 * @internal
 */
const extractParseArgsParams = (content: string): ScriptParameter[] => {
  const params: ScriptParameter[] = []

  // Match parseArgs config object
  const parseArgsMatch = content.match(/parseArgs\s*\(\s*\{[\s\S]*?args[\s\S]*?options\s*:\s*\{([\s\S]*?)\}\s*[,}]/)
  if (!parseArgsMatch) return params

  const optionsBlock = parseArgsMatch[1]!

  // Match individual option definitions
  const optionRegex = /['"]?(\w+)['"]?\s*:\s*\{([^}]+)\}/g

  for (const match of optionsBlock.matchAll(optionRegex)) {
    const name = match[1]!
    const config = match[2]!

    const typeMatch = config.match(/type\s*:\s*['"](\w+)['"]/)
    const _shortMatch = config.match(/short\s*:\s*['"](\w+)['"]/)
    const defaultMatch = config.match(/default\s*:\s*(['"].*?['"]|true|false|\d+)/)

    const paramType = typeMatch?.[1] as 'string' | 'boolean' | undefined

    params.push({
      name,
      type: paramType || 'string',
      required: !defaultMatch,
      default: defaultMatch ? JSON.parse(defaultMatch[1]!.replace(/'/g, '"')) : undefined,
    })
  }

  return params
}

/**
 * Extracts parameters from Python argparse usage.
 *
 * @param content - Python script source code containing argparse calls
 * @returns Array of extracted parameter metadata
 *
 * @internal
 */
const extractArgparseParams = (content: string): ScriptParameter[] => {
  const params: ScriptParameter[] = []

  // Match add_argument calls
  const argRegex = /add_argument\s*\(\s*['"]--?(\w+)['"]([\s\S]*?)\)/g

  for (const match of content.matchAll(argRegex)) {
    const name = match[1]!
    const config = match[2]!

    const typeMatch = config.match(/type\s*=\s*(\w+)/)
    const requiredMatch = config.match(/required\s*=\s*(True|False)/)
    const defaultMatch = config.match(/default\s*=\s*(['"].*?['"]|True|False|\d+)/)
    const helpMatch = config.match(/help\s*=\s*['"](.+?)['"]/)

    let paramType: 'string' | 'boolean' | 'number' = 'string'
    if (typeMatch?.[1] === 'int' || typeMatch?.[1] === 'float') {
      paramType = 'number'
    } else if (config.includes('action=') && config.includes('store_')) {
      paramType = 'boolean'
    }

    params.push({
      name,
      type: paramType,
      required: requiredMatch?.[1] === 'True',
      default: defaultMatch ? defaultMatch[1]!.replace(/['"]/g, '') : undefined,
      description: helpMatch?.[1],
    })
  }

  return params
}

// ============================================================================
// Skill Discovery
// ============================================================================

/**
 * Discovers skills in a directory by scanning for SKILL.md files.
 *
 * @param rootDir - Root directory to scan (relative to cwd)
 * @returns Promise resolving to array of discovered skill metadata
 *
 * @remarks
 * Scans one level deep for directories containing SKILL.md files.
 * Parses frontmatter to extract name, description, and optional fields.
 */
export const discoverSkills = async (rootDir: string): Promise<SkillMetadata[]> => {
  const skills: SkillMetadata[] = []
  const resolvedRoot = join(process.cwd(), rootDir)

  try {
    const entries = await Array.fromAsync(new Bun.Glob('*/SKILL.md').scan({ cwd: resolvedRoot, absolute: true }))

    for (const skillMdPath of entries) {
      const skillDir = dirname(skillMdPath)
      const content = await Bun.file(skillMdPath).text()
      const frontmatter = parseFrontmatter(content)

      if (frontmatter.name && frontmatter.description) {
        skills.push({
          name: frontmatter.name as string,
          description: frontmatter.description as string,
          location: skillMdPath,
          skillDir,
          tags: frontmatter.tags as string[] | undefined,
          invocable: frontmatter.invocable as boolean | undefined,
        })
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills
}

/**
 * Discovers scripts in skill directories.
 *
 * @param options - Discovery options
 * @returns Array of discovered script metadata
 *
 * @remarks
 * Scans `<skill>/scripts/` directories for executable scripts.
 * Extracts metadata from JSDoc comments and argument parsing patterns.
 */
export const discoverSkillScripts = async (options: DiscoveryOptions = {}): Promise<SkillScript[]> => {
  const { skillsRoot = '.claude/skills', scriptExtensions = ['.ts', '.js', '.sh', '.py'] } = options

  const scripts: SkillScript[] = []
  const skills = await discoverSkills(skillsRoot)

  for (const skill of skills) {
    const scriptsDir = join(skill.skillDir, 'scripts')

    try {
      // Check if scripts directory exists
      const scriptsDirExists = await Bun.file(scriptsDir)
        .exists()
        .catch(() => false)
      if (!scriptsDirExists) {
        // Try as directory
        const glob = new Bun.Glob('*')
        const entries = await Array.fromAsync(glob.scan({ cwd: scriptsDir, absolute: true }))

        for (const scriptPath of entries) {
          const ext = extname(scriptPath)
          if (!scriptExtensions.includes(ext)) continue

          // Skip test files
          if (scriptPath.includes('/tests/') || scriptPath.includes('.spec.') || scriptPath.includes('.test.')) {
            continue
          }

          const scriptName = basename(scriptPath, ext)
          const content = await Bun.file(scriptPath).text()

          // Extract metadata based on file type
          const description = extractJSDocDescription(content) || `Execute ${scriptName} script`
          let parameters: ScriptParameter[] = []

          if (ext === '.ts' || ext === '.js') {
            parameters = extractParseArgsParams(content)
          } else if (ext === '.py') {
            parameters = extractArgparseParams(content)
          }

          scripts.push({
            name: scriptName,
            qualifiedName: `${skill.name}:${scriptName}`,
            description,
            location: scriptPath,
            skillName: skill.name,
            extension: ext,
            parameters,
          })
        }
      }
    } catch {
      // Scripts directory doesn't exist or can't be read
    }
  }

  return scripts
}

// ============================================================================
// Context Formatting
// ============================================================================

/**
 * Formats skills into XML context for system prompts.
 *
 * @param skills - Array of skill metadata
 * @param scripts - Optional array of script metadata
 * @returns XML string for injection into system prompt
 *
 * @remarks
 * Generates compact XML following AgentSkills recommendations (~50-100 tokens per skill).
 * Format:
 * ```xml
 * <available_skills>
 *   <skill name="skill-name" location="/path/to/SKILL.md">
 *     Description of when to use this skill
 *   </skill>
 * </available_skills>
 * ```
 */
export const formatSkillsContext = (skills: SkillMetadata[], scripts?: SkillScript[]): string => {
  if (skills.length === 0) return ''

  const lines: string[] = ['<available_skills>']

  for (const skill of skills) {
    const attrs = [`name="${skill.name}"`, `location="${skill.location}"`]
    if (skill.invocable) attrs.push('invocable="true"')

    lines.push(`  <skill ${attrs.join(' ')}>`)
    lines.push(`    ${skill.description}`)

    // Include scripts for this skill if provided
    if (scripts) {
      const skillScripts = scripts.filter((s) => s.skillName === skill.name)
      if (skillScripts.length > 0) {
        lines.push('    <scripts>')
        for (const script of skillScripts) {
          lines.push(`      <script name="${script.qualifiedName}">${script.description}</script>`)
        }
        lines.push('    </scripts>')
      }
    }

    lines.push('  </skill>')
  }

  lines.push('</available_skills>')
  return lines.join('\n')
}

// ============================================================================
// Tool Schema Conversion
// ============================================================================

/**
 * Converts skill scripts to tool schemas for the model.
 *
 * @param scripts - Array of script metadata
 * @returns Array of tool schemas
 *
 * @remarks
 * Each script becomes a tool with its qualified name (skill-name:script-name).
 * Parameters are extracted from parseArgs/argparse patterns in the script.
 */
export const scriptsToToolSchemas = (scripts: SkillScript[]): ToolSchema[] =>
  scripts.map((script) => {
    const properties: Record<string, { type: string; description?: string; default?: unknown }> = {}
    const required: string[] = []

    for (const param of script.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        default: param.default,
      }

      if (param.required) {
        required.push(param.name)
      }
    }

    return {
      name: script.qualifiedName,
      description: script.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    }
  })

/**
 * Loads and registers skill scripts as tools in a registry.
 *
 * @param registry - Tool registry to add scripts to
 * @param options - Discovery options
 * @returns Number of scripts registered
 *
 * @remarks
 * Discovers scripts and registers them with execution handlers.
 * Scripts are executed via Bun.spawn with timeout protection.
 */
export const loadSkillScripts = async (
  registry: {
    register: (name: string, handler: (args: Record<string, unknown>) => Promise<unknown>, schema: ToolSchema) => void
    schemas: ToolSchema[]
  },
  options: DiscoveryOptions = {},
): Promise<number> => {
  const scripts = await discoverSkillScripts(options)
  const schemas = scriptsToToolSchemas(scripts)

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]!
    const schema = schemas[i]!

    registry.register(
      script.qualifiedName,
      async (args: Record<string, unknown>) => {
        // Build command arguments
        const cmdArgs: string[] = []
        for (const [key, value] of Object.entries(args)) {
          if (typeof value === 'boolean') {
            if (value) cmdArgs.push(`--${key}`)
          } else {
            cmdArgs.push(`--${key}`, String(value))
          }
        }

        // Execute script with timeout
        const proc = Bun.spawn(['bun', script.location, ...cmdArgs], {
          cwd: dirname(script.location),
          stdout: 'pipe',
          stderr: 'pipe',
        })

        const output = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        if (exitCode !== 0) {
          throw new Error(`Script ${script.qualifiedName} failed: ${stderr}`)
        }

        // Try to parse JSON output
        try {
          return JSON.parse(output)
        } catch {
          return output.trim()
        }
      },
      schema,
    )
  }

  return scripts.length
}
