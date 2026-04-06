import { parseCliRequest } from '../utils/cli.ts'
import {
  AutoresearchAcceptInputSchema,
  AutoresearchEvaluateInputSchema,
  AutoresearchEvaluateOutputSchema,
  AutoresearchInitInputSchema,
  AutoresearchLaneStateSchema,
  AutoresearchRevertInputSchema,
  AutoresearchStatusInputSchema,
} from './autoresearch.schemas.ts'
import {
  acceptAutoresearchLane,
  evaluateAutoresearchLane,
  initAutoresearchLane,
  loadAutoresearchLaneStatus,
  revertAutoresearchLane,
} from './autoresearch.ts'
import { buildAutoresearchHelp } from './autoresearch.utils.ts'

const buildUsage = () =>
  [
    "Usage: plaited autoresearch <init|evaluate|status> '<json>'",
    "       echo '<json>' | plaited autoresearch <init|evaluate|accept|revert|status>",
    '',
    buildAutoresearchHelp(),
  ].join('\n')

const initCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, AutoresearchInitInputSchema, {
    name: 'autoresearch init',
    outputSchema: AutoresearchLaneStateSchema,
  })
  const result = await initAutoresearchLane(input)
  console.log(JSON.stringify(result, null, 2))
}

const evaluateCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, AutoresearchEvaluateInputSchema, {
    name: 'autoresearch evaluate',
    outputSchema: AutoresearchEvaluateOutputSchema,
  })
  const result = await evaluateAutoresearchLane(input)
  console.log(JSON.stringify(result, null, 2))
}

const statusCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, AutoresearchStatusInputSchema, {
    name: 'autoresearch status',
    outputSchema: AutoresearchLaneStateSchema,
  })
  const result = await loadAutoresearchLaneStatus(input)
  console.log(JSON.stringify(result, null, 2))
}

const acceptCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, AutoresearchAcceptInputSchema, {
    name: 'autoresearch accept',
    outputSchema: AutoresearchLaneStateSchema,
  })
  const result = await acceptAutoresearchLane(input)
  console.log(JSON.stringify(result, null, 2))
}

const revertCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, AutoresearchRevertInputSchema, {
    name: 'autoresearch revert',
    outputSchema: AutoresearchLaneStateSchema,
  })
  const result = await revertAutoresearchLane(input)
  console.log(JSON.stringify(result, null, 2))
}

/**
 * CLI handler for the autoresearch command.
 *
 * @public
 */
export const autoresearchCli = async (args: string[]): Promise<void> => {
  const command = args[0]
  const commandArgs = args.slice(1)

  if (!command || command === '--help' || command === '-h') {
    console.error(buildUsage())
    process.exit(command ? 0 : 1)
  }

  if (command === 'init') {
    await initCommand(commandArgs)
    return
  }

  if (command === 'evaluate') {
    await evaluateCommand(commandArgs)
    return
  }

  if (command === 'status') {
    await statusCommand(commandArgs)
    return
  }

  if (command === 'accept') {
    await acceptCommand(commandArgs)
    return
  }

  if (command === 'revert') {
    await revertCommand(commandArgs)
    return
  }

  console.error(`Unknown autoresearch command: ${command}`)
  console.error(buildUsage())
  process.exit(1)
}
