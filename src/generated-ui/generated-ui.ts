import { Buffer } from 'node:buffer'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { TemplateObjectSchema } from '../render/template.schemas.ts'
import type { FunctionTemplate } from '../render/template.types.ts'
import {
  type GeneratedUiTemplateValidationResult,
  type ValidateGeneratedUiTemplateModuleInput,
  ValidateGeneratedUiTemplateModuleInputSchema,
} from './generated-ui.schemas.ts'

const formatBuildLogs = (logs: readonly unknown[]): string[] => logs.map((log) => String(log))

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const PACKAGE_ROOT = path.resolve(import.meta.dir, '../..')
const GENERATED_UI_RUNTIME_PATH = path.resolve(import.meta.dir, 'generated-ui-runtime.ts')

const importBundledModule = async (code: string): Promise<Record<string, unknown>> => {
  const encoded = Buffer.from(code).toString('base64url').slice(0, 48)
  const modulePath = path.join(Bun.env.TMPDIR ?? '/tmp', `plaited-generated-ui-${encoded}-${Date.now()}.mjs`)
  await Bun.write(modulePath, code)
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`) as Promise<Record<string, unknown>>
}

const normalizeVirtualPath = ({ cwd, filePath }: { cwd: string; filePath: string }): string => {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(cwd, filePath)
}

const buildVirtualModule = async ({
  cwd,
  entrypoint,
  files,
}: {
  cwd: string
  entrypoint: string
  files: Record<string, string>
}): Promise<{ code?: string; logs: string[] }> => {
  const normalizedEntrypoint = normalizeVirtualPath({ cwd, filePath: entrypoint })
  const normalizedFiles = Object.fromEntries(
    Object.entries(files).map(([filePath, source]) => [normalizeVirtualPath({ cwd, filePath }), source]),
  )
  const result = await Bun.build({
    entrypoints: [normalizedEntrypoint],
    files: normalizedFiles,
    format: 'esm',
    plugins: [
      {
        name: 'plaited-generated-ui-self-imports',
        setup(build) {
          build.onResolve({ filter: /^plaited\/ui$/ }, () => ({
            path: GENERATED_UI_RUNTIME_PATH,
          }))
        },
      },
    ],
    target: 'bun',
  }).catch((error) => ({
    success: false,
    outputs: [],
    logs: [error],
  }))
  const logs = formatBuildLogs(result.logs)
  if (!result.success) return { logs }
  const output = result.outputs[0]
  return {
    logs,
    code: output ? await output.text() : undefined,
  }
}

const typecheckVirtualModule = async ({
  cwd,
  entrypoint,
  files,
}: {
  cwd: string
  entrypoint: string
  files: Record<string, string>
}): Promise<string[]> => {
  const ts = await import('typescript')
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json')
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile).config : {}
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, cwd)
  const options = {
    ...parsed.options,
    baseUrl: cwd,
    ignoreDeprecations: '6.0',
    noEmit: true,
    paths: {
      ...(parsed.options.paths ?? {}),
      plaited: ['src/main.ts'],
      'plaited/ui': ['src/generated-ui/generated-ui-runtime.ts'],
      'plaited/*': ['src/*'],
    },
    rootDir: undefined,
  }
  const virtualFiles = new Map(
    Object.entries(files).map(([filePath, source]) => [normalizeVirtualPath({ cwd, filePath }), source]),
  )
  const host = ts.createCompilerHost(options)
  const originalFileExists = host.fileExists.bind(host)
  const originalReadFile = host.readFile.bind(host)

  host.fileExists = (filePath) => virtualFiles.has(path.normalize(filePath)) || originalFileExists(filePath)
  host.readFile = (filePath) => virtualFiles.get(path.normalize(filePath)) ?? originalReadFile(filePath)

  const rootNames = [normalizeVirtualPath({ cwd, filePath: entrypoint })]
  const program = ts.createProgram({
    rootNames,
    options,
    host,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  return diagnostics.map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (!diagnostic.file || diagnostic.start === undefined) return message
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    return `${diagnostic.file.fileName}:${position.line + 1}:${position.character + 1}: ${message}`
  })
}

/**
 * Validates DB or virtual-file generated UI source that exports a FunctionTemplate.
 *
 * @remarks
 * The source is typechecked, bundled from Bun's in-memory `files` map, imported,
 * invoked with fixture attrs, and validated as a compiled TemplateObject. This
 * keeps render and CSS behavior centralized in `src/render` and `src/css`.
 *
 * The generated module executes in the current Bun process during admission.
 * Callers must pass `execution: 'trusted-process-code'` to acknowledge that this
 * API is for trusted generated code, not sandboxed evaluation of untrusted input.
 *
 * @public
 */
export const validateGeneratedUiTemplateModule = async (
  input: ValidateGeneratedUiTemplateModuleInput,
): Promise<GeneratedUiTemplateValidationResult> => {
  const parsed = ValidateGeneratedUiTemplateModuleInputSchema.parse(input)
  try {
    if (parsed.typecheck) {
      const diagnostics = await typecheckVirtualModule({
        cwd: PACKAGE_ROOT,
        entrypoint: parsed.entrypoint,
        files: parsed.files,
      })
      if (diagnostics.length > 0) {
        return {
          type: 'ui.generated_template_validation_failed',
          detail: {
            entrypoint: parsed.entrypoint,
            exportName: parsed.exportName,
            repairable: true,
            error: {
              message: diagnostics.join('\n'),
            },
          },
        }
      }
    }

    const { code, logs } = await buildVirtualModule({
      cwd: PACKAGE_ROOT,
      entrypoint: parsed.entrypoint,
      files: parsed.files,
    })
    if (!code) {
      return {
        type: 'ui.generated_template_validation_failed',
        detail: {
          entrypoint: parsed.entrypoint,
          exportName: parsed.exportName,
          repairable: true,
          error: {
            message: 'Generated UI module build produced no output',
            logs,
          },
        },
      }
    }

    const module = await importBundledModule(code)
    const template = module[parsed.exportName]
    if (typeof template !== 'function') {
      throw new Error(`Generated UI module export is not a function: ${parsed.exportName}`)
    }
    const rendered = TemplateObjectSchema.parse((template as FunctionTemplate)(parsed.fixtureAttrs))
    return {
      type: 'ui.generated_template_validated',
      detail: {
        entrypoint: parsed.entrypoint,
        exportName: parsed.exportName,
        template: rendered,
        logs,
      },
    }
  } catch (error) {
    return {
      type: 'ui.generated_template_validation_failed',
      detail: {
        entrypoint: parsed.entrypoint,
        exportName: parsed.exportName,
        repairable: true,
        error: {
          message: getErrorMessage(error),
        },
      },
    }
  }
}
