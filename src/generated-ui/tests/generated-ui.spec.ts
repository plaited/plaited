import { describe, expect, test } from 'bun:test'

import { validateGeneratedUiTemplateModule } from 'plaited/generated-ui'

describe('generated UI template module admission', () => {
  test('validates a virtual FunctionTemplate module using render and CSS utilities', async () => {
    const result = await validateGeneratedUiTemplateModule({
      entrypoint: '/generated/workspace-card.ts',
      execution: 'trusted-process-code',
      files: {
        '/generated/workspace-card.ts': `
          import { createStyles, h, type FunctionTemplate } from 'plaited/ui'

          const styles = createStyles({
            card: {
              color: 'rgb(10, 20, 30)',
            },
          })

          const WorkspaceCard: FunctionTemplate<{ title: string }> = ({ title }) =>
            h('section', {
              ...styles.card,
              'p-target': 'main',
              children: title,
            })

          export default WorkspaceCard
        `,
      },
      fixtureAttrs: {
        title: 'Workspace',
      },
    })

    expect(result.type).toBe('ui.generated_template_validated')
    if (result.type !== 'ui.generated_template_validated') return
    expect(result.detail.template.html.join('')).toContain('p-target="main"')
    expect(result.detail.template.html.join('')).toContain('Workspace')
    expect(result.detail.template.stylesheets.join('')).toContain('color:rgb(10, 20, 30);')
  })

  test('reports TypeScript diagnostics before building a generated module', async () => {
    const result = await validateGeneratedUiTemplateModule({
      entrypoint: '/generated/broken.ts',
      execution: 'trusted-process-code',
      files: {
        '/generated/broken.ts': `
          import { h } from 'plaited/ui'

          const title: string = 42
          export default () => h('section', { children: title })
        `,
      },
    })

    expect(result.type).toBe('ui.generated_template_validation_failed')
    if (result.type !== 'ui.generated_template_validation_failed') return
    expect(result.detail.error.message).toContain("Type 'number' is not assignable to type 'string'")
  })

  test('rejects generated modules without a function export', async () => {
    const result = await validateGeneratedUiTemplateModule({
      entrypoint: '/generated/not-template.ts',
      execution: 'trusted-process-code',
      files: {
        '/generated/not-template.ts': `
          export default { kind: 'not-a-template' }
        `,
      },
    })

    expect(result.type).toBe('ui.generated_template_validation_failed')
    if (result.type !== 'ui.generated_template_validation_failed') return
    expect(result.detail.error.message).toContain('not a function')
  })

  test('resolves plaited UI imports when called outside the package root', async () => {
    const originalCwd = process.cwd()
    process.chdir('/private/tmp')
    try {
      const result = await validateGeneratedUiTemplateModule({
        entrypoint: '/generated/external-cwd.ts',
        execution: 'trusted-process-code',
        files: {
          '/generated/external-cwd.ts': `
            import { h, type FunctionTemplate } from 'plaited/ui'

            const ExternalCwd: FunctionTemplate<{ label: string }> = ({ label }) =>
              h('button', { children: label })

            export default ExternalCwd
          `,
        },
        fixtureAttrs: {
          label: 'External cwd',
        },
      })

      expect(result.type).toBe('ui.generated_template_validated')
      if (result.type !== 'ui.generated_template_validated') return
      expect(result.detail.template.html.join('')).toContain('External cwd')
    } finally {
      process.chdir(originalCwd)
    }
  })

  test('requires callers to acknowledge generated source executes as trusted process code', async () => {
    const missingExecutionInput = {
      entrypoint: '/generated/trust.ts',
      files: {
        '/generated/trust.ts': `export default () => ({ html: [], stylesheets: [], registry: [], $: '🦄' })`,
      },
    } as unknown as Parameters<typeof validateGeneratedUiTemplateModule>[0]

    await expect(validateGeneratedUiTemplateModule(missingExecutionInput)).rejects.toThrow()
  })
})
