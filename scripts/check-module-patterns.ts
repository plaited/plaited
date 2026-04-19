import { isAbsolute, resolve } from 'node:path'
import ts from 'typescript'
import * as z from 'zod'
import { parseCliRequest } from '../src/cli.ts'

export const ModulePatternCheckInputSchema = z.object({
  files: z.array(z.string().min(1)),
})

export const ModulePatternFindingSchema = z.object({
  severity: z.enum(['P1', 'P2']),
  ruleId: z.string().min(1),
  file: z.string().min(1),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  message: z.string().min(1),
  why: z.string().min(1),
  fix: z.string().min(1),
})

export const ModulePatternCheckOutputSchema = z.object({
  ok: z.boolean(),
  findings: z.array(ModulePatternFindingSchema),
})

export type ModulePatternCheckInput = z.infer<typeof ModulePatternCheckInputSchema>
export type ModulePatternFinding = z.infer<typeof ModulePatternFindingSchema>
export type ModulePatternCheckOutput = z.infer<typeof ModulePatternCheckOutputSchema>

type ExtensionHandlerContext = {
  file: string
  sourceFile: ts.SourceFile
  findings: ModulePatternFinding[]
  callback: ts.ArrowFunction | ts.FunctionExpression
}

const DIAGNOSTIC_HELPER_NAME_PATTERN = /(report|emit|error|diagnostic)/i
const ERROR_HELPER_NAME_PATTERN = /^(emit.*Error|report.*Error)$/i
const ALLOWED_EVENT_NAME_PATTERN = /(started|stopped|connected|disconnected|received|sent|queued|accepted)/i

const toLineColumn = (sourceFile: ts.SourceFile, node: ts.Node) => {
  const start = node.getStart(sourceFile)
  const position = sourceFile.getLineAndCharacterOfPosition(start)
  return {
    line: position.line + 1,
    column: position.character + 1,
  }
}

const addFinding = ({
  findings,
  sourceFile,
  node,
  file,
  severity,
  ruleId,
  message,
  why,
  fix,
}: {
  findings: ModulePatternFinding[]
  sourceFile: ts.SourceFile
  node: ts.Node
  file: string
  severity: 'P1' | 'P2'
  ruleId: string
  message: string
  why: string
  fix: string
}) => {
  const location = toLineColumn(sourceFile, node)
  findings.push({
    severity,
    ruleId,
    file,
    line: location.line,
    column: location.column,
    message,
    why,
    fix,
  })
}

const isFunctionLikeNode = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node)

const walk = ({
  node,
  visitor,
  skipNestedFunctions,
  rootFunction,
}: {
  node: ts.Node
  visitor: (node: ts.Node) => void
  skipNestedFunctions?: boolean
  rootFunction?: ts.Node
}) => {
  const visit = (current: ts.Node) => {
    if (skipNestedFunctions && current !== rootFunction && isFunctionLikeNode(current)) {
      return
    }

    visitor(current)
    ts.forEachChild(current, visit)
  }

  visit(node)
}

const getCalleeText = (sourceFile: ts.SourceFile, call: ts.CallExpression) => call.expression.getText(sourceFile)

const isUseExtensionCall = (node: ts.Node): node is ts.CallExpression => {
  if (!ts.isCallExpression(node)) {
    return false
  }

  if (ts.isIdentifier(node.expression) && node.expression.text === 'useExtension') {
    return true
  }

  if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'useExtension') {
    return true
  }

  return false
}

const getUseExtensionCallback = (call: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | null => {
  const callback = call.arguments[1]
  if (!callback) {
    return null
  }

  if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
    return callback
  }

  return null
}

const unwrapParenthesizedExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression
  }
  return current
}

const collectReturnedObjectLiterals = (
  callback: ts.ArrowFunction | ts.FunctionExpression,
): ts.ObjectLiteralExpression[] => {
  if (ts.isExpression(callback.body)) {
    const bodyExpression = unwrapParenthesizedExpression(callback.body)
    if (ts.isObjectLiteralExpression(bodyExpression)) {
      return [bodyExpression]
    }
  }

  if (!ts.isBlock(callback.body)) {
    return []
  }

  const literals: ts.ObjectLiteralExpression[] = []

  walk({
    node: callback.body,
    rootFunction: callback,
    skipNestedFunctions: true,
    visitor: (node) => {
      if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
        literals.push(node.expression)
      }
    },
  })

  return literals
}

const getHandlerEntries = (objectLiteral: ts.ObjectLiteralExpression) => {
  return objectLiteral.properties.flatMap((property) => {
    if (ts.isMethodDeclaration(property) && property.body) {
      return [
        {
          name: property.name.getText(objectLiteral.getSourceFile()),
          body: property.body,
          parameterName:
            property.parameters[0] && ts.isIdentifier(property.parameters[0].name)
              ? property.parameters[0].name.text
              : undefined,
          node: property as ts.Node,
        },
      ]
    }

    if (
      ts.isPropertyAssignment(property) &&
      (ts.isArrowFunction(property.initializer) || ts.isFunctionExpression(property.initializer))
    ) {
      const functionNode = property.initializer
      if (!functionNode.body || !ts.isBlock(functionNode.body)) {
        return []
      }

      const firstParam = functionNode.parameters[0]
      const parameterName = firstParam && ts.isIdentifier(firstParam.name) ? firstParam.name.text : undefined

      return [
        {
          name: property.name.getText(objectLiteral.getSourceFile()),
          body: functionNode.body,
          parameterName,
          node: property as ts.Node,
        },
      ]
    }

    return []
  })
}

const callUsesDetailParameter = ({
  call,
  detailParameterName,
}: {
  call: ts.CallExpression
  detailParameterName?: string
}) => {
  const detailName = detailParameterName ?? 'detail'
  const firstArgument = call.arguments[0]
  return Boolean(firstArgument && ts.isIdentifier(firstArgument) && firstArgument.text === detailName)
}

const tryParsesDetail = ({
  tryStatement,
  detailParameterName,
}: {
  tryStatement: ts.TryStatement
  detailParameterName?: string
}) => {
  let found = false

  walk({
    node: tryStatement.tryBlock,
    visitor: (node) => {
      if (found || !ts.isCallExpression(node)) {
        return
      }

      if (!ts.isPropertyAccessExpression(node.expression)) {
        return
      }

      if (node.expression.name.text !== 'parse') {
        return
      }

      if (callUsesDetailParameter({ call: node, detailParameterName })) {
        found = true
      }
    },
  })

  return found
}

const catchHandlesZodError = (tryStatement: ts.TryStatement, sourceFile: ts.SourceFile) => {
  if (!tryStatement.catchClause) {
    return false
  }

  const catchVariable =
    tryStatement.catchClause.variableDeclaration && ts.isIdentifier(tryStatement.catchClause.variableDeclaration.name)
      ? tryStatement.catchClause.variableDeclaration.name.text
      : null

  let found = false

  walk({
    node: tryStatement.catchClause.block,
    visitor: (node) => {
      if (found || !ts.isBinaryExpression(node)) {
        return
      }

      if (node.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) {
        return
      }

      const rightText = node.right.getText(sourceFile)
      if (!rightText.includes('ZodError')) {
        return
      }

      if (!catchVariable) {
        found = true
        return
      }

      const leftText = node.left.getText(sourceFile)
      if (leftText.includes(catchVariable)) {
        found = true
      }
    },
  })

  return found
}

const callHasTransportOrClientErrorName = ({
  call,
  sourceFile,
}: {
  call: ts.CallExpression
  sourceFile: ts.SourceFile
}) => {
  const calleeText = getCalleeText(sourceFile, call)
  return /(reportTransportError|emitClientError|emitTransportError|TransportError|ClientError)/.test(calleeText)
}

const getTriggerCreateEventInfo = ({
  call,
  sourceFile,
}: {
  call: ts.CallExpression
  sourceFile: ts.SourceFile
}): { eventName: string | null } | null => {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'trigger') {
    return null
  }

  const firstArgument = call.arguments[0]
  if (!firstArgument || !ts.isCallExpression(firstArgument)) {
    return null
  }

  const innerCalleeText = firstArgument.expression.getText(sourceFile)
  if (!/create.*Event/i.test(innerCalleeText)) {
    return null
  }

  const eventExpression = firstArgument.arguments[0]
  if (!eventExpression) {
    return { eventName: null }
  }

  if (ts.isStringLiteralLike(eventExpression)) {
    return { eventName: eventExpression.text }
  }

  if (ts.isPropertyAccessExpression(eventExpression)) {
    return { eventName: eventExpression.name.text }
  }

  if (ts.isElementAccessExpression(eventExpression) && ts.isStringLiteralLike(eventExpression.argumentExpression)) {
    return { eventName: eventExpression.argumentExpression.text }
  }

  return { eventName: eventExpression.getText(sourceFile) }
}

const isAllowedLifecycleEvent = (eventName: string | null) => {
  if (!eventName) {
    return false
  }

  return ALLOWED_EVENT_NAME_PATTERN.test(eventName)
}

const analyzeInternalHandlers = ({ file, sourceFile, findings, callback }: ExtensionHandlerContext) => {
  const returnedObjectLiterals = collectReturnedObjectLiterals(callback)

  for (const objectLiteral of returnedObjectLiterals) {
    const handlers = getHandlerEntries(objectLiteral)

    for (const handler of handlers) {
      walk({
        node: handler.body,
        visitor: (node) => {
          if (ts.isTryStatement(node)) {
            if (
              tryParsesDetail({
                tryStatement: node,
                detailParameterName: handler.parameterName,
              }) &&
              catchHandlesZodError(node, sourceFile)
            ) {
              addFinding({
                findings,
                sourceFile,
                node,
                file,
                severity: 'P1',
                ruleId: 'module/no-internal-zod-recovery',
                message: `Internal handler ${handler.name} catches z.ZodError from parse(detail).`,
                why: 'Internal control handlers should parse strictly and let useFeedback emit feedback_error.',
                fix: 'Remove local try/catch recovery around parse(detail) in the handler.',
              })
            }
          }

          if (ts.isCallExpression(node)) {
            if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'safeParse') {
              if (callUsesDetailParameter({ call: node, detailParameterName: handler.parameterName })) {
                addFinding({
                  findings,
                  sourceFile,
                  node,
                  file,
                  severity: 'P1',
                  ruleId: 'module/no-safeparse-in-internal-handler',
                  message: `Internal handler ${handler.name} uses safeParse(detail).`,
                  why: 'Internal control handlers should not silently recover from invalid internal payloads.',
                  fix: 'Use Schema.parse(detail) directly in the handler and allow feedback_error on invalid detail.',
                })
              }
            }

            if (callHasTransportOrClientErrorName({ call: node, sourceFile })) {
              addFinding({
                findings,
                sourceFile,
                node,
                file,
                severity: 'P1',
                ruleId: 'module/no-transport-diagnostic-from-internal-handler',
                message: `Internal handler ${handler.name} calls a transport/client diagnostic helper.`,
                why: 'Transport/client diagnostics belong to external ingress boundaries, not internal control handlers.',
                fix: 'Move this diagnostic to boundary ingress handling or use reportSnapshot for actor diagnostics.',
              })
            }
          }
        },
      })
    }
  }
}

const collectLocalHelpers = (callback: ts.ArrowFunction | ts.FunctionExpression) => {
  if (!ts.isBlock(callback.body)) {
    return [] as Array<{ name: string; body: ts.Block; node: ts.Node }>
  }

  const helpers: Array<{ name: string; body: ts.Block; node: ts.Node }> = []

  for (const statement of callback.body.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      helpers.push({
        name: statement.name.text,
        body: statement.body,
        node: statement.name,
      })
      continue
    }

    if (!ts.isVariableStatement(statement)) {
      continue
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue
      }

      if (!(ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
        continue
      }

      const functionBody = declaration.initializer.body
      if (!ts.isBlock(functionBody)) {
        continue
      }

      helpers.push({
        name: declaration.name.text,
        body: functionBody,
        node: declaration.name,
      })
    }
  }

  return helpers
}

const analyzeTriggeredDiagnosticEvents = ({ file, sourceFile, findings, callback }: ExtensionHandlerContext) => {
  const analyzeContext = ({ node, context }: { node: ts.Node; context: string }) => {
    walk({
      node,
      visitor: (current) => {
        if (!ts.isCallExpression(current)) {
          return
        }

        const info = getTriggerCreateEventInfo({ call: current, sourceFile })
        if (!info) {
          return
        }

        if (isAllowedLifecycleEvent(info.eventName)) {
          return
        }

        addFinding({
          findings,
          sourceFile,
          node: current,
          file,
          severity: 'P2',
          ruleId: 'module/no-triggered-diagnostic-event',
          message:
            `trigger(create*Event(...)) emits "${info.eventName ?? 'unknown'}" in ${context}. ` +
            'Review whether this is a real protocol event; otherwise use reportSnapshot.',
          why: 'Local diagnostics should usually be snapshot diagnostics, not synthetic domain events.',
          fix: 'If this is not a true protocol lifecycle event, replace it with reportSnapshot extension_error output.',
        })
      },
    })
  }

  walk({
    node: callback,
    rootFunction: callback,
    skipNestedFunctions: true,
    visitor: (node) => {
      if (ts.isCatchClause(node)) {
        analyzeContext({
          node: node.block,
          context: 'catch block',
        })
      }
    },
  })

  for (const helper of collectLocalHelpers(callback)) {
    if (!DIAGNOSTIC_HELPER_NAME_PATTERN.test(helper.name)) {
      continue
    }

    analyzeContext({
      node: helper.body,
      context: `helper ${helper.name}`,
    })
  }
}

const analyzeReportSnapshotPreference = ({ file, sourceFile, findings, callback }: ExtensionHandlerContext) => {
  for (const helper of collectLocalHelpers(callback)) {
    if (!ERROR_HELPER_NAME_PATTERN.test(helper.name)) {
      continue
    }

    let hasTriggerCall = false
    let hasReportSnapshotCall = false

    walk({
      node: helper.body,
      visitor: (node) => {
        if (!ts.isCallExpression(node)) {
          return
        }

        const calleeText = getCalleeText(sourceFile, node)
        if (calleeText.includes('reportSnapshot')) {
          hasReportSnapshotCall = true
        }

        if (calleeText === 'trigger' || calleeText.endsWith('.trigger')) {
          hasTriggerCall = true
        }
      },
    })

    if (!hasTriggerCall || hasReportSnapshotCall) {
      continue
    }

    addFinding({
      findings,
      sourceFile,
      node: helper.node,
      file,
      severity: 'P2',
      ruleId: 'module/prefer-report-snapshot-for-actor-diagnostics',
      message: `Helper ${helper.name} emits trigger(...) without reportSnapshot(...).`,
      why: 'Actor/runtime diagnostics should be published via reportSnapshot extension_error diagnostics.',
      fix: 'Use reportSnapshot for actor diagnostics and avoid synthetic trigger-based diagnostic events.',
    })
  }
}

const analyzeSourceFile = ({
  file,
  sourceFile,
  findings,
}: {
  file: string
  sourceFile: ts.SourceFile
  findings: ModulePatternFinding[]
}) => {
  walk({
    node: sourceFile,
    visitor: (node) => {
      if (!isUseExtensionCall(node)) {
        return
      }

      const callback = getUseExtensionCallback(node)
      if (!callback) {
        return
      }

      const context: ExtensionHandlerContext = {
        file,
        sourceFile,
        findings,
        callback,
      }

      analyzeInternalHandlers(context)
      analyzeTriggeredDiagnosticEvents(context)
      analyzeReportSnapshotPreference(context)
    },
  })
}

const sortFindings = (findings: ModulePatternFinding[]) => {
  findings.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file)
    }
    if (a.line !== b.line) {
      return a.line - b.line
    }
    if (a.column !== b.column) {
      return a.column - b.column
    }
    return a.ruleId.localeCompare(b.ruleId)
  })
}

const resolveInputFilePath = (file: string) => (isAbsolute(file) ? file : resolve(process.cwd(), file))

const getSourceFileParseDiagnostics = (sourceFile: ts.SourceFile): readonly ts.DiagnosticWithLocation[] => {
  return (
    (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? []
  )
}

const readSourceFile = async ({ file }: { file: string }) => {
  const absolutePath = resolveInputFilePath(file)
  const fileHandle = Bun.file(absolutePath)

  if (!(await fileHandle.exists())) {
    throw new Error(`Missing file: ${file}`)
  }

  const content = await fileHandle.text()
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  const parseDiagnostics = getSourceFileParseDiagnostics(sourceFile)
  if (parseDiagnostics.length > 0) {
    const firstDiagnostic = parseDiagnostics[0]
    if (!firstDiagnostic) {
      throw new Error(`Parse failed for ${file}`)
    }

    const diagnosticMessage = ts.flattenDiagnosticMessageText(firstDiagnostic.messageText, '\n')
    throw new Error(`Parse failed for ${file}: ${diagnosticMessage}`)
  }

  return sourceFile
}

export const checkModulePatterns = async (input: ModulePatternCheckInput): Promise<ModulePatternCheckOutput> => {
  const findings: ModulePatternFinding[] = []

  for (const file of input.files) {
    const sourceFile = await readSourceFile({ file })
    analyzeSourceFile({
      file,
      sourceFile,
      findings,
    })
  }

  sortFindings(findings)

  return {
    ok: findings.length === 0,
    findings,
  }
}

const renderHumanOutput = ({ output }: { output: ModulePatternCheckOutput }) => {
  if (output.findings.length === 0) {
    return 'No module pattern findings.'
  }

  const lines = output.findings.map((finding, index) => {
    return (
      `${index + 1}. [${finding.severity}] ${finding.ruleId} ${finding.file}:${finding.line}:${finding.column}\n` +
      `   ${finding.message}\n` +
      `   Why: ${finding.why}\n` +
      `   Fix: ${finding.fix}`
    )
  })

  return lines.join('\n')
}

export const checkModulePatternsCli = async (args: string[]) => {
  try {
    const { input, flags } = await parseCliRequest(args, ModulePatternCheckInputSchema, {
      name: 'scripts/check-module-patterns.ts',
      outputSchema: ModulePatternCheckOutputSchema,
      help: `Examples:\n  bun scripts/check-module-patterns.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"]}'\n  bun scripts/check-module-patterns.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"]}' --human`,
    })

    const output = await checkModulePatterns(input)

    if (flags.human) {
      console.log(renderHumanOutput({ output }))
    } else {
      console.log(JSON.stringify(output, null, 2))
    }

    process.exit(output.ok ? 0 : 1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}

if (import.meta.main) {
  await checkModulePatternsCli(Bun.argv.slice(2))
}
