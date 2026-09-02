import { describe, expect, test } from 'bun:test'
import { behavioral } from '../../main/behavioral.ts'
import { defineTool } from '../../tools/define-tool.ts'

const schema = { type: 'object' as const }
const baseRun = async () => ({ output: {} })

describe('tool name validation', () => {
  test('rejects reserved names at registration time', () => {
    const bp = behavioral()
    const hooks = {
      addHandler: bp.useAddHandler(),
      trigger: bp.useTrigger(),
      addThread: bp.useAddThread(),
    }

    // valid — registers without throwing
    defineTool({ name: 'get_weather', inputSchema: schema, outputSchema: schema, run: baseRun })(hooks)

    // invalid — each rejected at registration time
    expect(() =>
      defineTool({ name: 'foo_result', inputSchema: schema, outputSchema: schema, run: baseRun })(hooks),
    ).toThrow('reserved')
    expect(() =>
      defineTool({ name: 'tool.result', inputSchema: schema, outputSchema: schema, run: baseRun })(hooks),
    ).toThrow('reserved')
    expect(() => defineTool({ name: '', inputSchema: schema, outputSchema: schema, run: baseRun })(hooks)).toThrow(
      'reserved',
    )
  })
})
