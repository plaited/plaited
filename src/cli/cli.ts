/**
 * Shared CLI utilities for simple JSON-in / JSON-out commands.
 *
 * @remarks
 * Supports a stringified JSON positional input or stdin plus:
 * `--schema <input|output>`, `--dry-run`, and `--help`.
 *
 * @internal
 */

import * as z from 'zod'

/**
 * Parsed CLI flags shared by JSON-in / JSON-out commands.
 *
 * @property dryRun - When true, print the resolved request instead of executing it.
 *
 * @public
 */
export type CliFlags = {
  dryRun: boolean
}

/**
 * Options used when parsing a JSON-backed CLI request.
 *
 * @property name - Command name rendered in generated usage output.
 * @property outputSchema - Output schema used for `--schema output` and result validation.
 * @property help - Help text appended to the usage block.
 *
 * @public
 */
export type CliOptions = {
  name: string
  outputSchema: z.ZodType
  help: string
}

/**
 * Parsed CLI request data returned by `parseCliRequest`.
 *
 * @template TSchema - Input schema used to validate the request body.
 * @property input - Parsed input payload.
 * @property flags - Parsed CLI flags.
 *
 * @public
 */
export type ParsedCliRequest<TSchema extends z.ZodType> = {
  input: z.infer<TSchema>
  flags: CliFlags
}

type CliHandlerConfig<TInputSchema extends z.ZodType, TOutput> = {
  name: string
  inputSchema: TInputSchema
  outputSchema: z.ZodType<TOutput>
  help: string
  run: (input: z.infer<TInputSchema>, flags: CliFlags) => Promise<TOutput> | TOutput
}

type CliRouterConfig = {
  name: string
  description: string
  commands: Record<string, (args: string[]) => Promise<void>>
}

const buildUsage = ({ name, help }: { name: string; help: string }): string =>
  [
    `Usage: plaited ${name} '<json>' [options]`,
    `       echo '<json>' | plaited ${name}`,
    '',
    'Options:',
    '  --schema <input|output>  Output JSON schema and exit',
    '  --dry-run                Show request details without running the command',
    '  -h, --help               Show help',
    '',
    help,
  ].join('\n')

const getSchemaTarget = (args: string[]): 'input' | 'output' | null => {
  const schemaIndex = args.indexOf('--schema')
  if (schemaIndex === -1) return null

  const target = args[schemaIndex + 1]
  if (target === 'input' || target === 'output') return target

  console.error("Invalid value for --schema. Expected 'input' or 'output'.")
  process.exit(2)
}

const getPositionalInput = async (args: string[]): Promise<string | undefined> => {
  const positionals: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) continue

    if (arg === '--schema') {
      index += 1
      continue
    }
    if (arg === '--dry-run' || arg === '--help' || arg === '-h') {
      continue
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg)
    }
  }

  if (positionals.length > 0) return positionals[0]?.trim()

  if (!process.stdin.isTTY) {
    const stdinData = (await Bun.stdin.text()).trim()
    if (stdinData) return stdinData
  }

  return undefined
}

const parseJsonInput = (rawInput: string): unknown => {
  try {
    return JSON.parse(rawInput)
  } catch {
    console.error('Invalid JSON input')
    process.exit(2)
  }
}

const printSchema = (schema: z.ZodType): void => {
  console.log(JSON.stringify(z.toJSONSchema(schema), null, 2))
}

/**
 * Parses and validates a JSON CLI request with shared flag handling.
 *
 * @template TSchema - Input schema used to validate the request payload.
 * @param args - Raw command-line arguments after the command name.
 * @param schema - Zod schema used to validate the input payload.
 * @param options - Command metadata used for usage text and output validation.
 * @returns Parsed request input plus shared CLI flags.
 *
 * @public
 */
export const parseCliRequest = async <TSchema extends z.ZodType>(
  args: string[],
  schema: TSchema,
  options: CliOptions,
): Promise<ParsedCliRequest<TSchema>> => {
  if (args.includes('--help') || args.includes('-h')) {
    console.error(buildUsage(options))
    process.exit(0)
  }

  const schemaTarget = getSchemaTarget(args)
  if (schemaTarget === 'input') {
    printSchema(schema)
    process.exit(0)
  }
  if (schemaTarget === 'output') {
    printSchema(options.outputSchema)
    process.exit(0)
  }

  const rawInput = await getPositionalInput(args)
  if (!rawInput) {
    console.error(buildUsage(options))
    process.exit(2)
  }

  const parsed = schema.safeParse(parseJsonInput(rawInput))
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(2)
  }

  return {
    input: parsed.data,
    flags: {
      dryRun: args.includes('--dry-run'),
    },
  }
}

/**
 * Parses and validates a JSON CLI request, returning only the input payload.
 *
 * @template TSchema - Input schema used to validate the request payload.
 * @param args - Raw command-line arguments after the command name.
 * @param schema - Zod schema used to validate the input payload.
 * @param options - Command metadata used for usage text and output validation.
 * @returns Parsed CLI input.
 *
 * @public
 */
export const parseCli = async <TSchema extends z.ZodType>(
  args: string[],
  schema: TSchema,
  options: CliOptions,
): Promise<z.infer<TSchema>> => {
  const { input } = await parseCliRequest(args, schema, options)
  return input
}

/**
 * Creates a JSON-in / JSON-out CLI handler with shared parsing and validation.
 *
 * @template TInputSchema - Input schema type for the command.
 * @template TOutput - Output type produced by the command handler.
 * @param config - Command metadata, validation schemas, and execution callback.
 * @returns CLI handler that parses input, validates output, and prints JSON.
 *
 * @public
 */
export const makeCli = <TInputSchema extends z.ZodType, TOutput>({
  name,
  inputSchema,
  outputSchema,
  help,
  run,
}: CliHandlerConfig<TInputSchema, TOutput>) => ({
  [name]: async (args: string[]): Promise<void> => {
    const { input, flags } = await parseCliRequest(args, inputSchema, {
      name,
      outputSchema,
      help,
    })

    if (flags.dryRun) {
      console.log(
        JSON.stringify(
          {
            command: name,
            input,
            dryRun: true,
          },
          null,
          2,
        ),
      )
      return
    }

    const result = (await run(input, flags)) as TOutput

    const parsed = outputSchema.safeParse(result)
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2))
      process.exit(1)
    }

    console.log(JSON.stringify(parsed.data, null, 2))
  },
})

/**
 * Define and execute a self-contained CLI script.
 *
 * @remarks
 * Intended for generated `.ts` scripts invoked directly via `bun <filepath> '<json>'`.
 * Parses `process.argv`, handles `--help`, `--dry-run`, `--schema`, and runs the handler.
 * Uses the script filename as the display name in usage text.
 *
 * @template TInputSchema - Input schema type for the script.
 * @template TOutput - Output type produced by the script handler.
 * @param config - Input schema, output schema, help text, and run handler.
 *
 * @public
 */
export const defineScript = async <TInputSchema extends z.ZodType, TOutput>({
  inputSchema,
  outputSchema,
  help,
  run,
}: Omit<CliHandlerConfig<TInputSchema, TOutput>, 'name'>): Promise<void> => {
  const scriptName = process.argv[1]?.split('/').pop()?.split('.').shift() ?? 'script'
  const args = process.argv.slice(2)

  const { input, flags } = await parseCliRequest(args, inputSchema, {
    name: scriptName,
    outputSchema,
    help,
  })

  if (flags.dryRun) {
    console.log(
      JSON.stringify(
        {
          script: scriptName,
          input,
          dryRun: true,
        },
        null,
        2,
      ),
    )
    return
  }

  const result = (await run(input, flags)) as TOutput

  const parsed = outputSchema.safeParse(result)
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify(parsed.data, null, 2))
}

export const makeCliRouter =
  ({ name, description, commands }: CliRouterConfig) =>
  async (argv: string[]): Promise<void> => {
    const command = argv[2]
    const args = argv.slice(3)
    const commandNames = Object.keys(commands).sort()

    if (!command || command === '--help' || command === '-h') {
      console.error(`Usage: ${name} <command> [options]
       ${name} <command> --schema     # Discover input schema
       ${name} <command> '<json>'    # Structured JSON input
       ${name} --schema               # List all commands

Commands:
    ${commandNames.join(', ')}`)
      process.exit(command ? 0 : 1)
    }

    if (command === '--schema') {
      console.log(
        JSON.stringify(
          {
            name,
            description,
            commands: commandNames,
            usage: `${name} <command> '<json>' | --schema input`,
            discovery: `${name} --schema`,
          },
          null,
          2,
        ),
      )
      process.exit(0)
    }

    const handler = commands[command]
    if (!handler) {
      console.error(`Unknown command: ${command}`)
      console.error(`Run '${name} --help' to see available commands`)
      process.exit(1)
    }

    await handler(args).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
  }
