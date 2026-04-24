import { describe, expect, test } from 'bun:test'

const skillRoot = `${import.meta.dir}/..`

describe('add-protected-remote-mcp skill', () => {
  test('documents the no-secrets-in-repo rule and protected use cases', async () => {
    const skill = await Bun.file(`${skillRoot}/SKILL.md`).text()

    expect(skill).toContain('No secrets in repo')
    expect(skill).toContain('Varlock')
    expect(skill).toContain('1Password')
    expect(skill).toContain('resolveConfiguredRemoteMcpOptions')
  })

  test('generic templates accept arbitrary JSON input instead of query-only payloads', async () => {
    const oneShot = await Bun.file(`${skillRoot}/references/one-shot-tool-template.ts`).text()
    const session = await Bun.file(`${skillRoot}/references/session-tool-template.ts`).text()

    expect(oneShot).toContain(`JSON.parse(raw)`)
    expect(session).toContain(`JSON.parse(raw)`)
    expect(oneShot).not.toContain('input.query')
    expect(session).not.toContain('input.query')
  })

  test('protected template uses declarative auth config instead of checked-in secrets', async () => {
    const template = await Bun.file(`${skillRoot}/references/protected-session-tool-template.ts`).text()

    expect(template).toContain('resolveConfiguredRemoteMcpOptions')
    expect(template).toContain(`envVar: 'EXAMPLE_MCP_CLIENT_SECRET'`)
    expect(template).toContain(`kind: 'varlock-1password'`)
    expect(template).toContain('refreshMaterialStore')
    expect(template).not.toContain('OAuthClientProvider')
    expect(template).not.toContain('access_token:')
    expect(template).not.toContain('refresh_token:')
  })
})
