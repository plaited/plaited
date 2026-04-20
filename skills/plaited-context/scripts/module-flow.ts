import { isAbsolute, resolve } from 'node:path'
import ts from 'typescript'
import * as z from 'zod'
import { parseCliRequest } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

export const ModuleFlowRenderInputSchema = OperationalContextOverrideSchema.extend({
  files: z.array(z.string().min(1)).min(1).describe('Module actor files to analyze for runtime/module flow evidence.'),
  format: z.enum(['json', 'mermaid']).default('json').describe('Output evidence format.'),
  record: z
    .boolean()
    .default(false)
    .describe('When true, records module-flow evidence findings in plaited-context SQLite DB.'),
}).describe('Input contract for module flow extraction and review evidence rendering.')

const SourceLocationSchema = z
  .object({
    line: z.number().int().positive().describe('1-based source line.'),
    column: z.number().int().positive().describe('1-based source column.'),
  })
  .describe('Source location for a flow fact.')

const ParseCallFactSchema = z
  .object({
    method: z.enum(['parse', 'safeParse']).describe('Parser method used at the call site.'),
    schema: z.string().min(1).describe('Schema expression used for parse/safeParse.'),
    argument: z.string().min(1).describe('Argument expression passed to parse/safeParse.'),
    location: SourceLocationSchema.describe('Source location for the parse call.'),
  })
  .describe('Observed parse/safeParse call fact.')

const TryCatchBoundaryFactSchema = z
  .object({
    tryLocation: SourceLocationSchema.describe('Location of the try block.'),
    catchLocation: SourceLocationSchema.nullable().describe('Location of catch block when present.'),
    finallyLocation: SourceLocationSchema.nullable().describe('Location of finally block when present.'),
  })
  .describe('Observed try/catch/finally boundary fact.')

const TriggerEventFactSchema = z
  .object({
    callee: z.string().min(1).describe('Trigger call callee expression.'),
    factory: z.string().min(1).describe('Event factory expression used inside trigger call.'),
    eventName: z.string().nullable().describe('Resolved event name expression when identifiable.'),
    location: SourceLocationSchema.describe('Source location for the trigger(create*Event(...)) call.'),
  })
  .describe('Observed trigger(create*Event(...)) fact.')

const CallFactSchema = z
  .object({
    callee: z.string().min(1).describe('Call expression callee text.'),
    location: SourceLocationSchema.describe('Source location for this call.'),
  })
  .describe('Observed call fact for selected diagnostic surfaces.')

const HelperCallFactSchema = z
  .object({
    helperName: z.string().min(1).describe('Resolved local helper name targeted by the call.'),
    callee: z.string().min(1).describe('Original callee expression text.'),
    location: SourceLocationSchema.describe('Source location for the helper call edge.'),
  })
  .describe('Observed handler/helper to helper call edge fact.')

const HandlerFlowSchema = z
  .object({
    name: z.string().min(1).describe('Handler property/method name.'),
    location: SourceLocationSchema.describe('Location of the handler declaration.'),
    parseCalls: z.array(ParseCallFactSchema).describe('parse/safeParse calls inside the handler.'),
    tryCatchBoundaries: z.array(TryCatchBoundaryFactSchema).describe('try/catch boundaries inside the handler.'),
    triggerEventCalls: z.array(TriggerEventFactSchema).describe('trigger(create*Event(...)) calls inside the handler.'),
    reportSnapshotCalls: z.array(CallFactSchema).describe('reportSnapshot-like calls inside the handler.'),
    transportDiagnosticCalls: z.array(CallFactSchema).describe('transport/client diagnostic calls inside the handler.'),
    helperCalls: z.array(HelperCallFactSchema).describe('Handler-to-helper call edges.'),
  })
  .describe('Flow facts extracted for one returned handler.')

const HelperFlowSchema = z
  .object({
    name: z.string().min(1).describe('Local helper name.'),
    location: SourceLocationSchema.describe('Location of the helper declaration.'),
    parseCalls: z.array(ParseCallFactSchema).describe('parse/safeParse calls inside the helper.'),
    tryCatchBoundaries: z.array(TryCatchBoundaryFactSchema).describe('try/catch boundaries inside the helper.'),
    triggerEventCalls: z.array(TriggerEventFactSchema).describe('trigger(create*Event(...)) calls inside the helper.'),
    reportSnapshotCalls: z.array(CallFactSchema).describe('reportSnapshot-like calls inside the helper.'),
    transportDiagnosticCalls: z.array(CallFactSchema).describe('transport/client diagnostic calls inside the helper.'),
    helperCalls: z.array(HelperCallFactSchema).describe('Helper-to-helper call edges.'),
  })
  .describe('Flow facts extracted for one local helper.')

const ExtensionFlowSchema = z
  .object({
    idExpression: z.string().nullable().describe('Raw expression used as the useExtension id argument.'),
    location: SourceLocationSchema.describe('Location of the useExtension call.'),
    handlers: z.array(HandlerFlowSchema).describe('Returned handlers extracted for this extension callback.'),
    helpers: z.array(HelperFlowSchema).describe('Local helpers extracted for this extension callback.'),
  })
  .describe('Flow facts extracted for one useExtension call.')

const FileFlowSchema = z
  .object({
    file: z.string().min(1).describe('Analyzed module file path.'),
    extensions: z.array(ExtensionFlowSchema).describe('useExtension flow facts extracted from this file.'),
  })
  .describe('Flow facts for one analyzed file.')

export const ModuleFlowGraphSchema = z
  .object({
    files: z.array(FileFlowSchema).describe('Flow facts grouped by analyzed file.'),
  })
  .describe('Structured module/runtime flow graph facts.')

export const ModuleFlowRenderOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates module flow extraction completed successfully.'),
    files: z.array(FileFlowSchema).describe('Flow facts grouped by analyzed file.'),
    graph: ModuleFlowGraphSchema.describe('Graph wrapper for structured flow facts.'),
    mermaid: z
      .string()
      .describe('Deterministic Mermaid flowchart text when format is mermaid; otherwise an empty string.'),
  })
  .describe('Output contract for module flow extraction and Mermaid evidence rendering.')

export type ModuleFlowRenderInput = z.input<typeof ModuleFlowRenderInputSchema>
type ParsedModuleFlowRenderInput = z.infer<typeof ModuleFlowRenderInputSchema>
export type SourceLocation = z.infer<typeof SourceLocationSchema>
export type ModuleFlowRenderOutput = z.infer<typeof ModuleFlowRenderOutputSchema>

const ModuleFlowFindingDetailsSchema = z
  .object({
    source: z.literal('module-flow'),
    file: z.string().min(1),
    format: z.enum(['json', 'mermaid']),
    extensions: z.number().int().nonnegative(),
    handlers: z.number().int().nonnegative(),
    helpers: z.number().int().nonnegative(),
  })
  .describe('Structured details payload for module-flow evidence findings.')

type ModuleFlowFindingDetails = z.infer<typeof ModuleFlowFindingDetailsSchema>

type HandlerEntry = {
  name: string
  body: ts.Block
  node: ts.Node
}

type LocalHelperEntry = {
  name: string
  body: ts.ConciseBody
  node: ts.Node
}

const TRANSPORT_DIAGNOSTIC_HELPER_NAMES = new Set(['reportTransportError', 'emitClientError', 'emitTransportError'])

const toLineColumn = (sourceFile: ts.SourceFile, node: ts.Node): SourceLocation => {
  const start = node.getStart(sourceFile)
  const position = sourceFile.getLineAndCharacterOfPosition(start)
  return {
    line: position.line + 1,
    column: position.character + 1,
  }
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

const unwrapParenthesizedExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression
  }
  return current
}

const getCalleeText = (sourceFile: ts.SourceFile, call: ts.CallExpression) => call.expression.getText(sourceFile)

const isTransportDiagnosticHelperCall = (call: ts.CallExpression): boolean => {
  if (ts.isIdentifier(call.expression)) {
    return TRANSPORT_DIAGNOSTIC_HELPER_NAMES.has(call.expression.text)
  }

  if (ts.isPropertyAccessExpression(call.expression)) {
    return TRANSPORT_DIAGNOSTIC_HELPER_NAMES.has(call.expression.name.text)
  }

  if (ts.isElementAccessExpression(call.expression) && ts.isStringLiteralLike(call.expression.argumentExpression)) {
    return TRANSPORT_DIAGNOSTIC_HELPER_NAMES.has(call.expression.argumentExpression.text)
  }

  return false
}

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

const getHandlerEntries = (objectLiteral: ts.ObjectLiteralExpression): HandlerEntry[] => {
  const handlers: HandlerEntry[] = []

  for (const property of objectLiteral.properties) {
    if (ts.isMethodDeclaration(property) && property.body) {
      handlers.push({
        name: property.name.getText(objectLiteral.getSourceFile()),
        body: property.body,
        node: property,
      })
      continue
    }

    if (
      ts.isPropertyAssignment(property) &&
      (ts.isArrowFunction(property.initializer) || ts.isFunctionExpression(property.initializer))
    ) {
      const functionNode = property.initializer
      if (!ts.isBlock(functionNode.body)) {
        continue
      }

      handlers.push({
        name: property.name.getText(objectLiteral.getSourceFile()),
        body: functionNode.body,
        node: property,
      })
    }
  }

  return handlers
}

const collectLocalHelpers = (callback: ts.ArrowFunction | ts.FunctionExpression): LocalHelperEntry[] => {
  if (!ts.isBlock(callback.body)) {
    return []
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

const getTriggerCreateEventInfo = ({
  call,
  sourceFile,
}: {
  call: ts.CallExpression
  sourceFile: ts.SourceFile
}): { callee: string; factory: string; eventName: string | null } | null => {
  const calleeText = getCalleeText(sourceFile, call)
  if (!(calleeText === 'trigger' || calleeText.endsWith('.trigger'))) {
    return null
  }

  const firstArgument = call.arguments[0]
  if (!firstArgument || !ts.isCallExpression(firstArgument)) {
    return null
  }

  const factoryText = firstArgument.expression.getText(sourceFile)
  if (!/create.*Event/i.test(factoryText)) {
    return null
  }

  const eventExpression = firstArgument.arguments[0]
  if (!eventExpression) {
    return {
      callee: calleeText,
      factory: factoryText,
      eventName: null,
    }
  }

  if (ts.isStringLiteralLike(eventExpression)) {
    return {
      callee: calleeText,
      factory: factoryText,
      eventName: eventExpression.text,
    }
  }

  if (ts.isPropertyAccessExpression(eventExpression)) {
    return {
      callee: calleeText,
      factory: factoryText,
      eventName: eventExpression.name.text,
    }
  }

  if (ts.isElementAccessExpression(eventExpression) && ts.isStringLiteralLike(eventExpression.argumentExpression)) {
    return {
      callee: calleeText,
      factory: factoryText,
      eventName: eventExpression.argumentExpression.text,
    }
  }

  return {
    callee: calleeText,
    factory: factoryText,
    eventName: eventExpression.getText(sourceFile),
  }
}

const compareLocations = (a: SourceLocation, b: SourceLocation) => {
  if (a.line !== b.line) {
    return a.line - b.line
  }
  return a.column - b.column
}

const sortByLocation = <T extends { location: SourceLocation }>(items: T[]): void => {
  items.sort((a, b) => compareLocations(a.location, b.location))
}

const analyzeBodyFacts = ({ sourceFile, body }: { sourceFile: ts.SourceFile; body: ts.ConciseBody }) => {
  const parseCalls: z.infer<typeof ParseCallFactSchema>[] = []
  const tryCatchBoundaries: z.infer<typeof TryCatchBoundaryFactSchema>[] = []
  const triggerEventCalls: z.infer<typeof TriggerEventFactSchema>[] = []
  const reportSnapshotCalls: z.infer<typeof CallFactSchema>[] = []
  const transportDiagnosticCalls: z.infer<typeof CallFactSchema>[] = []

  walk({
    node: body,
    rootFunction: body,
    skipNestedFunctions: true,
    visitor: (node) => {
      if (ts.isTryStatement(node)) {
        tryCatchBoundaries.push({
          tryLocation: toLineColumn(sourceFile, node.tryBlock),
          catchLocation: node.catchClause ? toLineColumn(sourceFile, node.catchClause.block) : null,
          finallyLocation: node.finallyBlock ? toLineColumn(sourceFile, node.finallyBlock) : null,
        })
      }

      if (!ts.isCallExpression(node)) {
        return
      }

      const calleeText = getCalleeText(sourceFile, node)

      if (ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text
        if (methodName === 'parse' || methodName === 'safeParse') {
          const firstArgument = node.arguments[0]
          parseCalls.push({
            method: methodName,
            schema: node.expression.expression.getText(sourceFile),
            argument: firstArgument ? firstArgument.getText(sourceFile) : '<missing>',
            location: toLineColumn(sourceFile, node),
          })
        }
      }

      const triggerInfo = getTriggerCreateEventInfo({ call: node, sourceFile })
      if (triggerInfo) {
        triggerEventCalls.push({
          callee: triggerInfo.callee,
          factory: triggerInfo.factory,
          eventName: triggerInfo.eventName,
          location: toLineColumn(sourceFile, node),
        })
      }

      if (calleeText.includes('reportSnapshot')) {
        reportSnapshotCalls.push({
          callee: calleeText,
          location: toLineColumn(sourceFile, node),
        })
      }

      if (isTransportDiagnosticHelperCall(node)) {
        transportDiagnosticCalls.push({
          callee: calleeText,
          location: toLineColumn(sourceFile, node),
        })
      }
    },
  })

  sortByLocation(parseCalls)
  tryCatchBoundaries.sort((a, b) => compareLocations(a.tryLocation, b.tryLocation))
  sortByLocation(triggerEventCalls)
  sortByLocation(reportSnapshotCalls)
  sortByLocation(transportDiagnosticCalls)

  return {
    parseCalls,
    tryCatchBoundaries,
    triggerEventCalls,
    reportSnapshotCalls,
    transportDiagnosticCalls,
  }
}

const collectHelperCalls = ({
  sourceFile,
  body,
  helperNames,
  currentHelperName,
}: {
  sourceFile: ts.SourceFile
  body: ts.ConciseBody
  helperNames: Set<string>
  currentHelperName?: string
}) => {
  const helperCalls: z.infer<typeof HelperCallFactSchema>[] = []

  walk({
    node: body,
    rootFunction: body,
    skipNestedFunctions: true,
    visitor: (node) => {
      if (!ts.isCallExpression(node)) {
        return
      }

      if (ts.isIdentifier(node.expression) && helperNames.has(node.expression.text)) {
        if (currentHelperName !== undefined && node.expression.text === currentHelperName) {
          return
        }

        helperCalls.push({
          helperName: node.expression.text,
          callee: node.expression.text,
          location: toLineColumn(sourceFile, node),
        })
      }

      const calleeText = getCalleeText(sourceFile, node)
      if (ts.isPropertyAccessExpression(node.expression)) {
        const helperName = node.expression.name.text
        if (!helperNames.has(helperName)) {
          return
        }

        if (currentHelperName !== undefined && helperName === currentHelperName) {
          return
        }

        helperCalls.push({
          helperName,
          callee: calleeText,
          location: toLineColumn(sourceFile, node),
        })
      }
    },
  })

  sortByLocation(helperCalls)
  return helperCalls
}

const analyzeHandler = ({
  sourceFile,
  handler,
  helperNames,
}: {
  sourceFile: ts.SourceFile
  handler: HandlerEntry
  helperNames: Set<string>
}): z.infer<typeof HandlerFlowSchema> => {
  const flowFacts = analyzeBodyFacts({
    sourceFile,
    body: handler.body,
  })
  const helperCalls = collectHelperCalls({
    sourceFile,
    body: handler.body,
    helperNames,
  })

  return {
    name: handler.name,
    location: toLineColumn(sourceFile, handler.node),
    ...flowFacts,
    helperCalls,
  }
}

const analyzeHelper = ({
  sourceFile,
  helper,
  helperNames,
}: {
  sourceFile: ts.SourceFile
  helper: LocalHelperEntry
  helperNames: Set<string>
}): z.infer<typeof HelperFlowSchema> => {
  return {
    name: helper.name,
    location: toLineColumn(sourceFile, helper.node),
    ...analyzeBodyFacts({
      sourceFile,
      body: helper.body,
    }),
    helperCalls: collectHelperCalls({
      sourceFile,
      body: helper.body,
      helperNames,
      currentHelperName: helper.name,
    }),
  }
}

const analyzeFile = async ({ file }: { file: string }): Promise<z.infer<typeof FileFlowSchema>> => {
  const absolutePath = isAbsolute(file) ? file : resolve(process.cwd(), file)
  const fileHandle = Bun.file(absolutePath)
  if (!(await fileHandle.exists())) {
    throw new Error(`Missing file: ${file}`)
  }

  const content = await fileHandle.text()
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const parseDiagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? []

  if (parseDiagnostics.length > 0) {
    const firstDiagnostic = parseDiagnostics[0]
    const diagnosticMessage = ts.flattenDiagnosticMessageText(firstDiagnostic?.messageText ?? 'Parse failed', '\n')
    throw new Error(`Parse failed for ${file}: ${diagnosticMessage}`)
  }

  const extensions: z.infer<typeof ExtensionFlowSchema>[] = []

  walk({
    node: sourceFile,
    visitor: (node) => {
      if (!isUseExtensionCall(node)) {
        return
      }

      const callback = getUseExtensionCallback(node)
      const handlers: z.infer<typeof HandlerFlowSchema>[] = []
      const helpers: z.infer<typeof HelperFlowSchema>[] = []

      if (callback) {
        const localHelpers = collectLocalHelpers(callback)
        const helperNames = new Set(localHelpers.map((helper) => helper.name))

        for (const helper of localHelpers) {
          helpers.push(
            analyzeHelper({
              sourceFile,
              helper,
              helperNames,
            }),
          )
        }

        for (const objectLiteral of collectReturnedObjectLiterals(callback)) {
          for (const handler of getHandlerEntries(objectLiteral)) {
            handlers.push(
              analyzeHandler({
                sourceFile,
                handler,
                helperNames,
              }),
            )
          }
        }
      }

      handlers.sort((a, b) => {
        const locationCompare = compareLocations(a.location, b.location)
        if (locationCompare !== 0) {
          return locationCompare
        }
        return a.name.localeCompare(b.name)
      })
      helpers.sort((a, b) => {
        const locationCompare = compareLocations(a.location, b.location)
        if (locationCompare !== 0) {
          return locationCompare
        }
        return a.name.localeCompare(b.name)
      })

      extensions.push({
        idExpression: node.arguments[0] ? node.arguments[0].getText(sourceFile) : null,
        location: toLineColumn(sourceFile, node),
        handlers,
        helpers,
      })
    },
  })

  extensions.sort((a, b) => {
    const locationCompare = compareLocations(a.location, b.location)
    if (locationCompare !== 0) {
      return locationCompare
    }
    return (a.idExpression ?? '').localeCompare(b.idExpression ?? '')
  })

  return {
    file,
    extensions,
  }
}

const formatLocation = (location: SourceLocation) => `${location.line}:${location.column}`

const escapeMermaidLabel = (value: string) => value.replaceAll('"', "'")

const renderMermaid = ({ graph }: { graph: z.infer<typeof ModuleFlowGraphSchema> }) => {
  const lines = ['flowchart TD']
  let nodeCount = 0

  const addNode = (label: string) => {
    nodeCount += 1
    const nodeId = `N${nodeCount}`
    lines.push(`  ${nodeId}["${escapeMermaidLabel(label)}"]`)
    return nodeId
  }

  const addEdge = (from: string, to: string, label?: string) => {
    if (label) {
      lines.push(`  ${from} -->|${escapeMermaidLabel(label)}| ${to}`)
      return
    }

    lines.push(`  ${from} --> ${to}`)
  }

  const renderFlowFacts = ({
    ownerNode,
    parseCalls,
    tryCatchBoundaries,
    triggerEventCalls,
    reportSnapshotCalls,
    transportDiagnosticCalls,
  }: {
    ownerNode: string
    parseCalls: z.infer<typeof ParseCallFactSchema>[]
    tryCatchBoundaries: z.infer<typeof TryCatchBoundaryFactSchema>[]
    triggerEventCalls: z.infer<typeof TriggerEventFactSchema>[]
    reportSnapshotCalls: z.infer<typeof CallFactSchema>[]
    transportDiagnosticCalls: z.infer<typeof CallFactSchema>[]
  }) => {
    for (const parseCall of parseCalls) {
      const parseNode = addNode(
        `${parseCall.method} ${parseCall.schema}(${parseCall.argument}) @${formatLocation(parseCall.location)}`,
      )
      addEdge(ownerNode, parseNode, 'parse')
    }

    for (const boundary of tryCatchBoundaries) {
      const tryNode = addNode(`try @${formatLocation(boundary.tryLocation)}`)
      addEdge(ownerNode, tryNode, 'try')

      if (boundary.catchLocation) {
        const catchNode = addNode(`catch @${formatLocation(boundary.catchLocation)}`)
        addEdge(tryNode, catchNode, 'catch')
      }

      if (boundary.finallyLocation) {
        const finallyNode = addNode(`finally @${formatLocation(boundary.finallyLocation)}`)
        addEdge(tryNode, finallyNode, 'finally')
      }
    }

    for (const triggerEvent of triggerEventCalls) {
      const triggerNode = addNode(
        `trigger ${triggerEvent.factory}(${triggerEvent.eventName ?? 'unknown'}) @${formatLocation(triggerEvent.location)}`,
      )
      addEdge(ownerNode, triggerNode, 'trigger')
    }

    for (const snapshotCall of reportSnapshotCalls) {
      const snapshotNode = addNode(`${snapshotCall.callee} @${formatLocation(snapshotCall.location)}`)
      addEdge(ownerNode, snapshotNode, 'snapshot')
    }

    for (const transportCall of transportDiagnosticCalls) {
      const transportNode = addNode(`${transportCall.callee} @${formatLocation(transportCall.location)}`)
      addEdge(ownerNode, transportNode, 'transport')
    }
  }

  for (const fileFlow of graph.files) {
    const fileNode = addNode(`file ${fileFlow.file}`)

    for (const extension of fileFlow.extensions) {
      const extensionNode = addNode(
        `useExtension(${extension.idExpression ?? 'unknown'}) @${formatLocation(extension.location)}`,
      )
      addEdge(fileNode, extensionNode)
      const helperNodes = new Map<string, string>()

      for (const helper of extension.helpers) {
        const helperNode = addNode(`helper ${helper.name} @${formatLocation(helper.location)}`)
        helperNodes.set(helper.name, helperNode)
        addEdge(extensionNode, helperNode, 'helper')
      }

      for (const helper of extension.helpers) {
        const helperNode = helperNodes.get(helper.name)
        if (!helperNode) {
          continue
        }

        renderFlowFacts({
          ownerNode: helperNode,
          parseCalls: helper.parseCalls,
          tryCatchBoundaries: helper.tryCatchBoundaries,
          triggerEventCalls: helper.triggerEventCalls,
          reportSnapshotCalls: helper.reportSnapshotCalls,
          transportDiagnosticCalls: helper.transportDiagnosticCalls,
        })

        for (const helperCall of helper.helperCalls) {
          const targetHelperNode = helperNodes.get(helperCall.helperName)
          if (!targetHelperNode) {
            continue
          }

          addEdge(
            helperNode,
            targetHelperNode,
            `calls ${helperCall.helperName} @${formatLocation(helperCall.location)}`,
          )
        }
      }

      for (const handler of extension.handlers) {
        const handlerNode = addNode(`handler ${handler.name} @${formatLocation(handler.location)}`)
        addEdge(extensionNode, handlerNode)
        renderFlowFacts({
          ownerNode: handlerNode,
          parseCalls: handler.parseCalls,
          tryCatchBoundaries: handler.tryCatchBoundaries,
          triggerEventCalls: handler.triggerEventCalls,
          reportSnapshotCalls: handler.reportSnapshotCalls,
          transportDiagnosticCalls: handler.transportDiagnosticCalls,
        })

        for (const helperCall of handler.helperCalls) {
          const helperNode = helperNodes.get(helperCall.helperName)
          if (!helperNode) {
            continue
          }

          addEdge(handlerNode, helperNode, `calls ${helperCall.helperName} @${formatLocation(helperCall.location)}`)
        }
      }
    }
  }

  return lines.join('\n')
}

const summarizeFileFlow = (fileFlow: z.infer<typeof FileFlowSchema>) => {
  const extensionCount = fileFlow.extensions.length
  const handlerCount = fileFlow.extensions.reduce((count, extension) => count + extension.handlers.length, 0)
  const helperCount = fileFlow.extensions.reduce((count, extension) => count + extension.helpers.length, 0)
  return {
    extensionCount,
    handlerCount,
    helperCount,
  }
}

const safeParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const parseModuleFlowFindingDetails = (details: string | null): ModuleFlowFindingDetails | null => {
  if (!details) {
    return null
  }

  const parsed = ModuleFlowFindingDetailsSchema.safeParse(safeParseJson(details))
  return parsed.success ? parsed.data : null
}

const recordFlowEvidence = async ({
  input,
  files,
}: {
  input: ParsedModuleFlowRenderInput
  files: z.infer<typeof FileFlowSchema>[]
}) => {
  if (!input.record) {
    return
  }

  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const selectCandidatePatternFindings = db.query(
      `SELECT id, details
       FROM findings
       WHERE kind = 'pattern' AND status = 'candidate'
       ORDER BY id ASC`,
    )
    const insertCandidateFinding = db.query(
      `INSERT INTO findings (kind, status, summary, details, created_at, updated_at)
       VALUES ('pattern', 'candidate', ?, ?, ?, ?)`,
    )
    const updateFinding = db.query(
      `UPDATE findings
       SET summary = ?, details = ?, updated_at = ?
       WHERE id = ?`,
    )
    const retireFinding = db.query(
      `UPDATE findings
       SET status = 'retired', updated_at = ?
       WHERE id = ?`,
    )
    const deleteFindingEvidence = db.query(`DELETE FROM finding_evidence WHERE finding_id = ?`)
    const insertFindingEvidence = db.query(
      `INSERT INTO finding_evidence (finding_id, path, line, symbol, excerpt, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    for (const fileFlow of files) {
      const summary = summarizeFileFlow(fileFlow)
      const primaryLocation = fileFlow.extensions[0]?.location

      const detailPayload: ModuleFlowFindingDetails = {
        source: 'module-flow',
        file: fileFlow.file,
        format: input.format,
        extensions: summary.extensionCount,
        handlers: summary.handlerCount,
        helpers: summary.helperCount,
      }
      const detailPayloadText = JSON.stringify(detailPayload, null, 2)
      const summaryText =
        `module-flow evidence for ${fileFlow.file}: ` +
        `${summary.extensionCount} extension(s), ${summary.handlerCount} handler(s), ${summary.helperCount} helper(s)`
      const evidenceExcerpt = `extensions=${summary.extensionCount}, handlers=${summary.handlerCount}, helpers=${summary.helperCount}`

      const candidateRows = selectCandidatePatternFindings.all() as Array<{
        id: number
        details: string | null
      }>
      const matchingCandidateIds = candidateRows
        .filter((row) => {
          const rowDetails = parseModuleFlowFindingDetails(row.details)
          if (!rowDetails) {
            return false
          }

          return rowDetails.file === detailPayload.file && rowDetails.format === detailPayload.format
        })
        .map((row) => row.id)

      const timestamp = new Date().toISOString()
      const writeEvidenceForFinding = db.transaction((findingId: number) => {
        deleteFindingEvidence.run(findingId)
        insertFindingEvidence.run(
          findingId,
          fileFlow.file,
          primaryLocation?.line ?? null,
          'module-flow',
          evidenceExcerpt,
          timestamp,
        )
      })

      if (matchingCandidateIds.length === 0) {
        const inserted = insertCandidateFinding.run(summaryText, detailPayloadText, timestamp, timestamp)
        const findingId = Number(inserted.lastInsertRowid)
        writeEvidenceForFinding(findingId)
        continue
      }

      const canonicalFindingId = matchingCandidateIds[0] as number
      updateFinding.run(summaryText, detailPayloadText, timestamp, canonicalFindingId)
      writeEvidenceForFinding(canonicalFindingId)

      for (const duplicateFindingId of matchingCandidateIds.slice(1)) {
        retireFinding.run(timestamp, duplicateFindingId)
      }
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const renderModuleFlow = async (input: ModuleFlowRenderInput): Promise<ModuleFlowRenderOutput> => {
  const parsedInput = ModuleFlowRenderInputSchema.parse(input)
  const files: z.infer<typeof FileFlowSchema>[] = []

  for (const file of parsedInput.files) {
    files.push(await analyzeFile({ file }))
  }

  const graph = {
    files,
  }

  const mermaid = parsedInput.format === 'mermaid' ? renderMermaid({ graph }) : ''

  await recordFlowEvidence({
    input: parsedInput,
    files,
  })

  return {
    ok: true,
    files,
    graph,
    mermaid,
  }
}

export const moduleFlowCli = async (args: string[]) => {
  try {
    const { input } = await parseCliRequest(args, ModuleFlowRenderInputSchema, {
      name: 'skills/plaited-context/scripts/module-flow.ts',
      outputSchema: ModuleFlowRenderOutputSchema,
      help: [
        'Examples:',
        `  bun skills/plaited-context/scripts/module-flow.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"],"format":"json"}'`,
        `  bun skills/plaited-context/scripts/module-flow.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"],"format":"mermaid"}'`,
        `  bun skills/plaited-context/scripts/module-flow.ts --schema output`,
      ].join('\n'),
    })

    const output = await renderModuleFlow(input)
    console.log(JSON.stringify(output, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}

if (import.meta.main) {
  await moduleFlowCli(Bun.argv.slice(2))
}
