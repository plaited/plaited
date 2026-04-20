import { isAbsolute, resolve } from 'node:path'
import ts from 'typescript'
import * as z from 'zod'
import { parseCliRequest } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  type FindingInput,
  OperationalContextOverrideSchema,
  openContextDatabase,
  recordFinding,
  resolveOperationalContext,
} from './plaited-context.ts'

export const ModulePatternCheckInputSchema = OperationalContextOverrideSchema.extend({
  files: z.array(z.string().min(1)).min(1).describe('Module actor files to analyze with deterministic pattern checks.'),
  record: z
    .boolean()
    .default(false)
    .describe('When true, records deterministic findings into plaited-context SQLite DB.'),
}).describe('Input contract for deterministic module pattern checking.')

export const ModulePatternFindingSchema = z
  .object({
    severity: z.enum(['P1', 'P2']).describe('Deterministic rule severity for the finding.'),
    ruleId: z.string().min(1).describe('Stable deterministic rule identifier.'),
    file: z.string().min(1).describe('Path of the analyzed module file where the finding was produced.'),
    line: z.number().int().positive().describe('1-based line for the finding location.'),
    column: z.number().int().positive().describe('1-based column for the finding location.'),
    message: z.string().min(1).describe('Short operator-facing finding message.'),
    why: z.string().min(1).describe('Reason this pattern is considered unsafe or incorrect.'),
    fix: z.string().min(1).describe('Suggested deterministic remediation guidance.'),
  })
  .describe('Single deterministic module-pattern finding.')

export const ModulePatternCheckOutputSchema = z
  .object({
    ok: z.boolean().describe('True when no deterministic findings were produced.'),
    findings: z.array(ModulePatternFindingSchema).describe('Deterministically ordered module-pattern findings.'),
  })
  .describe('Output contract for deterministic module pattern checking.')

export type ModulePatternCheckInput = z.input<typeof ModulePatternCheckInputSchema>
type ParsedModulePatternCheckInput = z.infer<typeof ModulePatternCheckInputSchema>
export type ModulePatternFinding = z.infer<typeof ModulePatternFindingSchema>
export type ModulePatternCheckOutput = z.infer<typeof ModulePatternCheckOutputSchema>

type ExtensionHandlerContext = {
  file: string
  sourceFile: ts.SourceFile
  findings: ModulePatternFinding[]
  callback: ts.ArrowFunction | ts.FunctionExpression
  localHelpers: LocalHelperEntry[]
  transportBoundaryHelperNames: Set<string>
}

const DIAGNOSTIC_HELPER_NAME_PATTERN = /(report|emit|error|diagnostic)/i
const ERROR_HELPER_NAME_PATTERN = /^(emit.*Error|report.*Error)$/i
const ALLOWED_EVENT_NAME_PATTERN = /(started|stopped|connected|disconnected|received|sent|queued|accepted)/i
const TRANSPORT_BOUNDARY_CALLBACK_NAME_PATTERN = /^reportTransportError$/i
const TRANSPORT_BOUNDARY_CALLBACK_TYPE_PATTERN = /\breportTransportError\b/
const BOUNDARY_OBSERVABILITY_EVENT_NAME_PATTERN =
  /(client|connection|transport|protocol|ingress|egress|envelope|message|request|response|origin|upgrade|websocket|topic|session|peer|route|path)/i
const SYNTHETIC_DIAGNOSTIC_EVENT_NAME_PATTERN =
  /(server_error|runtime_error|actor_error|internal_error|diagnostic|snapshot|feedback)/i

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
      if (!ts.isReturnStatement(node) || !node.expression) {
        return
      }

      const returnExpression = unwrapParenthesizedExpression(node.expression)
      if (ts.isObjectLiteralExpression(returnExpression)) {
        literals.push(returnExpression)
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

type LocalHelperEntry = {
  name: string
  body: ts.ConciseBody
  node: ts.Node
}

type TransportBoundaryCallbackEntry = {
  name: string
  body: ts.ConciseBody
}

const collectLocalHelpers = (callback: ts.ArrowFunction | ts.FunctionExpression) => {
  if (!ts.isBlock(callback.body)) {
    return [] as LocalHelperEntry[]
  }

  const helpers: LocalHelperEntry[] = []

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

      helpers.push({
        name: declaration.name.text,
        body: declaration.initializer.body,
        node: declaration.name,
      })
    }
  }

  return helpers
}

const getDeclarationTypeText = ({
  declaration,
  sourceFile,
}: {
  declaration: ts.VariableDeclaration
  sourceFile: ts.SourceFile
}): string | null => {
  const typeNode = declaration.type
  if (!typeNode) {
    return null
  }

  return typeNode.getText(sourceFile)
}

const hasTransportBoundaryCallbackSignal = ({ name, typeText }: { name: string; typeText: string | null }) => {
  if (TRANSPORT_BOUNDARY_CALLBACK_NAME_PATTERN.test(name)) {
    return true
  }

  if (!typeText) {
    return false
  }

  return TRANSPORT_BOUNDARY_CALLBACK_TYPE_PATTERN.test(typeText)
}

const collectTransportBoundaryCallbacks = ({
  callback,
  sourceFile,
}: {
  callback: ts.ArrowFunction | ts.FunctionExpression
  sourceFile: ts.SourceFile
}): TransportBoundaryCallbackEntry[] => {
  if (!ts.isBlock(callback.body)) {
    return []
  }

  const callbacks: TransportBoundaryCallbackEntry[] = []

  for (const statement of callback.body.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      if (hasTransportBoundaryCallbackSignal({ name: statement.name.text, typeText: null })) {
        callbacks.push({
          name: statement.name.text,
          body: statement.body,
        })
      }
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

      const typeText = getDeclarationTypeText({
        declaration,
        sourceFile,
      })

      if (
        hasTransportBoundaryCallbackSignal({
          name: declaration.name.text,
          typeText,
        })
      ) {
        callbacks.push({
          name: declaration.name.text,
          body: declaration.initializer.body,
        })
      }
    }
  }

  return callbacks
}

const collectCalledHelperNames = ({
  sourceFile,
  body,
  helperNameSet,
}: {
  sourceFile: ts.SourceFile
  body: ts.ConciseBody
  helperNameSet: Set<string>
}) => {
  const calls = new Set<string>()

  walk({
    node: body,
    rootFunction: body,
    skipNestedFunctions: true,
    visitor: (node) => {
      if (!ts.isCallExpression(node)) {
        return
      }

      if (!ts.isIdentifier(node.expression)) {
        return
      }

      if (!helperNameSet.has(node.expression.text)) {
        return
      }

      calls.add(node.expression.text)
    },
  })

  return calls
}

const collectTransportBoundaryHelperNames = ({
  callback,
  sourceFile,
  localHelpers,
}: {
  callback: ts.ArrowFunction | ts.FunctionExpression
  sourceFile: ts.SourceFile
  localHelpers: LocalHelperEntry[]
}) => {
  const helperByName = new Map(localHelpers.map((helper) => [helper.name, helper]))
  const helperNameSet = new Set(localHelpers.map((helper) => helper.name))
  const transportBoundaryHelperNames = new Set<string>()
  const queue: string[] = []

  const transportBoundaryCallbacks = collectTransportBoundaryCallbacks({
    callback,
    sourceFile,
  })

  for (const boundaryCallback of transportBoundaryCallbacks) {
    if (helperNameSet.has(boundaryCallback.name) && !transportBoundaryHelperNames.has(boundaryCallback.name)) {
      transportBoundaryHelperNames.add(boundaryCallback.name)
      queue.push(boundaryCallback.name)
    }

    for (const helperName of collectCalledHelperNames({
      sourceFile,
      body: boundaryCallback.body,
      helperNameSet,
    })) {
      if (transportBoundaryHelperNames.has(helperName)) {
        continue
      }
      transportBoundaryHelperNames.add(helperName)
      queue.push(helperName)
    }
  }

  while (queue.length > 0) {
    const helperName = queue.shift()
    if (!helperName) {
      continue
    }

    const helper = helperByName.get(helperName)
    if (!helper) {
      continue
    }

    for (const calledHelperName of collectCalledHelperNames({
      sourceFile,
      body: helper.body,
      helperNameSet,
    })) {
      if (transportBoundaryHelperNames.has(calledHelperName)) {
        continue
      }
      transportBoundaryHelperNames.add(calledHelperName)
      queue.push(calledHelperName)
    }
  }

  return transportBoundaryHelperNames
}

const isBoundaryObservabilityEvent = (eventName: string | null) => {
  if (!eventName) {
    return false
  }

  if (SYNTHETIC_DIAGNOSTIC_EVENT_NAME_PATTERN.test(eventName)) {
    return false
  }

  return BOUNDARY_OBSERVABILITY_EVENT_NAME_PATTERN.test(eventName)
}

const analyzeTriggeredDiagnosticEvents = ({
  file,
  sourceFile,
  findings,
  callback,
  localHelpers,
  transportBoundaryHelperNames,
}: ExtensionHandlerContext) => {
  const analyzeContext = ({ node, context, helperName }: { node: ts.Node; context: string; helperName?: string }) => {
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

        if (
          helperName &&
          transportBoundaryHelperNames.has(helperName) &&
          isBoundaryObservabilityEvent(info.eventName)
        ) {
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

  for (const objectLiteral of collectReturnedObjectLiterals(callback)) {
    for (const handler of getHandlerEntries(objectLiteral)) {
      analyzeContext({
        node: handler.body,
        context: `internal handler ${handler.name}`,
      })
    }
  }

  for (const helper of localHelpers) {
    if (!DIAGNOSTIC_HELPER_NAME_PATTERN.test(helper.name)) {
      continue
    }

    analyzeContext({
      node: helper.body,
      context: `helper ${helper.name}`,
      helperName: helper.name,
    })
  }
}

const analyzeReportSnapshotPreference = ({
  file,
  sourceFile,
  findings,
  localHelpers,
  transportBoundaryHelperNames,
}: ExtensionHandlerContext) => {
  for (const helper of localHelpers) {
    if (!ERROR_HELPER_NAME_PATTERN.test(helper.name)) {
      continue
    }

    let hasTriggerCall = false
    let hasReportSnapshotCall = false
    let hasNonBoundaryTriggerCall = false

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

          const triggerInfo = getTriggerCreateEventInfo({
            call: node,
            sourceFile,
          })
          const isBoundaryTrigger =
            transportBoundaryHelperNames.has(helper.name) &&
            isBoundaryObservabilityEvent(triggerInfo?.eventName ?? null)

          if (!isBoundaryTrigger) {
            hasNonBoundaryTriggerCall = true
          }
        }
      },
    })

    if (!hasTriggerCall || hasReportSnapshotCall) {
      continue
    }

    if (transportBoundaryHelperNames.has(helper.name) && !hasNonBoundaryTriggerCall) {
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

      const localHelpers = collectLocalHelpers(callback)
      const transportBoundaryHelperNames = collectTransportBoundaryHelperNames({
        callback,
        sourceFile,
        localHelpers,
      })

      const context: ExtensionHandlerContext = {
        file,
        sourceFile,
        findings,
        callback,
        localHelpers,
        transportBoundaryHelperNames,
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

const recordFindings = async ({
  input,
  findings,
}: {
  input: ParsedModulePatternCheckInput
  findings: ModulePatternFinding[]
}) => {
  if (!input.record || findings.length === 0) {
    return
  }

  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    for (const finding of findings) {
      const findingInput: FindingInput = {
        kind: 'anti-pattern',
        status: 'validated',
        summary: `${finding.ruleId}: ${finding.message}`,
        details: [`Severity: ${finding.severity}`, `Why: ${finding.why}`, `Fix: ${finding.fix}`].join('\n'),
        evidence: [
          {
            path: finding.file,
            line: finding.line,
            symbol: finding.ruleId,
            excerpt: finding.message,
          },
        ],
      }

      recordFinding({
        db,
        finding: findingInput,
      })
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const checkModulePatterns = async (input: ModulePatternCheckInput): Promise<ModulePatternCheckOutput> => {
  const parsedInput = ModulePatternCheckInputSchema.parse(input)
  const findings: ModulePatternFinding[] = []

  for (const file of parsedInput.files) {
    const sourceFile = await readSourceFile({ file })
    analyzeSourceFile({
      file,
      sourceFile,
      findings,
    })
  }

  sortFindings(findings)
  await recordFindings({
    input: parsedInput,
    findings,
  })

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

export const modulePatternsCli = async (args: string[]) => {
  try {
    const { input, flags } = await parseCliRequest(args, ModulePatternCheckInputSchema, {
      name: 'skills/plaited-context/scripts/module-patterns.ts',
      outputSchema: ModulePatternCheckOutputSchema,
      help: [
        'Examples:',
        `  bun skills/plaited-context/scripts/module-patterns.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"]}'`,
        `  bun skills/plaited-context/scripts/module-patterns.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"],"record":true,"dbPath":".plaited/context.sqlite"}'`,
        `  bun skills/plaited-context/scripts/module-patterns.ts --schema output`,
      ].join('\n'),
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
  await modulePatternsCli(Bun.argv.slice(2))
}
