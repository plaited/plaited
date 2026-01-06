#!/usr/bin/env bun
/**
 * Compute and filter rewards from trajectory data.
 *
 * Usage:
 *   bun scripts/compute-rewards.ts <input> [options]
 *
 * Options:
 *   --output, -o      Output file path (default: stdout)
 *   --min-reward, -m  Minimum reward threshold (default: 0)
 *   --stats, -s       Print statistics only
 *   --help, -h        Show this help message
 *
 * Examples:
 *   bun scripts/compute-rewards.ts trajectories.jsonl
 *   bun scripts/compute-rewards.ts trajectories.jsonl --min-reward 0.7 -o filtered.jsonl
 *   bun scripts/compute-rewards.ts trajectories.jsonl --stats
 */

import { parseArgs } from 'node:util'
import { computeTrajectoryStats, type Trajectory } from 'plaited/agent'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o' },
    'min-reward': { type: 'string', short: 'm', default: '0' },
    stats: { type: 'boolean', short: 's' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Compute and filter rewards from trajectory data.

Usage:
  bun scripts/compute-rewards.ts <input> [options]

Options:
  --output, -o      Output file path (default: stdout)
  --min-reward, -m  Minimum reward threshold (default: 0)
  --stats, -s       Print statistics only
  --help, -h        Show this help message

Examples:
  bun scripts/compute-rewards.ts trajectories.jsonl
  bun scripts/compute-rewards.ts trajectories.jsonl --min-reward 0.7 -o filtered.jsonl
  bun scripts/compute-rewards.ts trajectories.jsonl --stats
`)
  process.exit(values.help ? 0 : 1)
}

const inputPath = positionals[0]!
const minReward = Number.parseFloat(values['min-reward'] ?? '0')

const main = async () => {
  const file = Bun.file(inputPath)

  if (!(await file.exists())) {
    console.error(`Error: File not found: ${inputPath}`)
    process.exit(1)
  }

  const content = await file.text()
  const lines = content.trim().split('\n')

  const trajectories: Trajectory[] = lines.filter((line) => line.trim()).map((line) => JSON.parse(line) as Trajectory)

  console.error(`Loaded ${trajectories.length} trajectories from ${inputPath}`)

  // Compute stats on all data
  const allStats = computeTrajectoryStats(trajectories)

  console.error(`\nAll trajectories:`)
  console.error(`  Count: ${allStats.count}`)
  console.error(`  Mean reward: ${allStats.meanReward.toFixed(3)}`)
  console.error(`  Pass rate: ${(allStats.passRate * 100).toFixed(1)}%`)
  console.error(`  A11y pass rate: ${(allStats.a11yPassRate * 100).toFixed(1)}%`)

  if (values.stats) {
    // Stats only mode - exit after printing
    return
  }

  // Filter by minimum reward
  const filtered = trajectories.filter((t) => t.reward >= minReward)

  if (minReward > 0) {
    const filteredStats = computeTrajectoryStats(filtered)

    console.error(`\nFiltered (reward >= ${minReward}):`)
    console.error(`  Count: ${filteredStats.count}`)
    console.error(`  Mean reward: ${filteredStats.meanReward.toFixed(3)}`)
    console.error(`  Pass rate: ${(filteredStats.passRate * 100).toFixed(1)}%`)
    console.error(`  A11y pass rate: ${(filteredStats.a11yPassRate * 100).toFixed(1)}%`)
  }

  // Output filtered trajectories
  const output = filtered.map((t) => JSON.stringify(t)).join('\n')

  if (values.output) {
    await Bun.write(values.output, output)
    console.error(`\nWritten ${filtered.length} trajectories to: ${values.output}`)
  } else {
    console.log(output)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
