import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import {
  behavioral,
  type SelectionSnapshot,
  SNAPSHOT_MESSAGE_KINDS,
  type Spec,
  SpecSchema,
  useSpec,
} from '../../behavioral.ts'

const INSTRUCTION_MAINTENANCE_SPEC_PATH = resolve(import.meta.dir, '../instruction-maintenance.jsonl')

const loadInstructionMaintenanceSpecs = async (): Promise<Spec[]> => {
  const file = Bun.file(INSTRUCTION_MAINTENANCE_SPEC_PATH)
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

  expect(lines.length).toBeGreaterThan(0)

  return lines.map((line) => SpecSchema.parse(JSON.parse(line)))
}

describe('instruction maintenance seed spec', () => {
  test('parses, compiles, and runs through the behavioral runtime', async () => {
    const specs = await loadInstructionMaintenanceSpecs()
    const runtime = behavioral()
    const selectedTypes: string[] = []

    runtime.useSnapshot((snapshot) => {
      if (snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection) {
        const selection = snapshot as SelectionSnapshot
        selectedTypes.push(selection.selected.type)
      }
    })

    for (const spec of specs) {
      const [label, specThread] = useSpec(spec)
      runtime.addThread(label, specThread)
    }

    runtime.trigger({ type: 'agent.instruction_update.observed' })

    expect(selectedTypes).toContain('agent.instruction_update.observed')
    expect(selectedTypes).toContain('agent.instruction_update.propose')
  })
})
