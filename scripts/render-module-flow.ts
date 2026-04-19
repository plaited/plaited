import { isAbsolute, resolve } from 'node:path'
import ts from 'typescript'
import * as z from 'zod'
import { parseCliRequest } from '../src/cli.ts'

export const ModuleFlowRenderInputSchema = z.object({
  files: z.array(z.string().min(1)),
  format: z.enum(['json', 'mermaid']).default('json'),
})

const SourceLocationSchema = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
})

const ParseCallFactSchema = z.object({
  method: z.enum(['parse', 'safeParse']),
  schema: z.string().min(1),
  argument: z.string().min(1),
  location: SourceLocationSchema,
})

const TryCatchBoundaryFactSchema = z.object({
  tryLocation: SourceLocationSchema,
  catchLocation: SourceLocationSchema.nullable(),
  finallyLocation: SourceLocationSchema.nullable(),
})

const TriggerEventFactSchema = z.object({
  callee: z.string().min(1),
  factory: z.string().min(1),
  eventName: z.string().nullable(),
  location: SourceLocationSchema,
})

const CallFactSchema = z.object({
  callee: z.string().min(1),
  location: SourceLocationSchema,
})

const HelperCallFactSchema = z.object({
  helperName: z.string().min(1),
  callee: z.string().min(1),
  location: SourceLocationSchema,
})

const HandlerFlowSchema = z.object({
  name: z.string().min(1),
  location: SourceLocationSchema,
  parseCalls: z.array(ParseCallFactSchema),
  tryCatchBoundaries: z.array(TryCatchBoundaryFactSchema),
  triggerEventCalls: z.array(TriggerEventFactSchema),
  reportSnapshotCalls: z.array(CallFactSchema),
  transportDiagnosticCalls: z.array(CallFactSchema),
  helperCalls: z.array(HelperCallFactSchema),
})

const HelperFlowSchema = z.object({
  name: z.string().min(1),
  location: SourceLocationSchema,
  parseCalls: z.array(ParseCallFactSchema),
  tryCatchBoundaries: z.array(TryCatchBoundaryFactSchema),
  triggerEventCalls: z.array(TriggerEventFactSchema),
  reportSnapshotCalls: z.array(CallFactSchema),
  transportDiagnosticCalls: z.array(CallFactSchema),
  helperCalls: z.array(HelperCallFactSchema),
})

const ExtensionFlowSchema = z.object({
  idExpression: z.string().nullable(),
  location: SourceLocationSchema,
  handlers: z.array(HandlerFlowSchema),
  helpers: z.array(HelperFlowSchema),
})

const FileFlowSchema = z.object({
  file: z.string().min(1),
  extensions: z.array(ExtensionFlowSchema),
})

export const ModuleFlowGraphSchema = z.object({
  files: z.array(FileFlowSchema),
})

export const ModuleFlowRenderOutputSchema = z.discriminatedUnion('format', [
  z.object({
    ok: z.literal(true),
    format: z.literal('json'),
    graph: ModuleFlowGraphSchema,
  }),
  z.object({
    ok: z.literal(true),
    format: z.literal('mermaid'),
    graph: ModuleFlowGraphSchema,
    mermaid: z.string().min(1),
  }),
])

export type ModuleFlowRenderInput = z.infer<typeof ModuleFlowRenderInputSchema>
export type SourceLocation = z.infer<typeof SourceLocationSchema>
export type ModuleFlowRenderOutput = z.infer<typeof ModuleFlowRenderOutputSchema>

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

const TRANSPORT_DIAGNOSTIC_NAME_PATTERN =
  /(reportTransportError|emitClientError|emitTransportError|TransportError|ClientError)/

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

      if (TRANSPORT_DIAGNOSTIC_NAME_PATTERN.test(calleeText)) {
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

export const renderModuleFlow = async (input: ModuleFlowRenderInput): Promise<ModuleFlowRenderOutput> => {
  const files: z.infer<typeof FileFlowSchema>[] = []

  for (const file of input.files) {
    files.push(await analyzeFile({ file }))
  }

  const graph = {
    files,
  }

  if (input.format === 'mermaid') {
    return {
      ok: true,
      format: 'mermaid',
      graph,
      mermaid: renderMermaid({ graph }),
    }
  }

  return {
    ok: true,
    format: 'json',
    graph,
  }
}

export const renderModuleFlowCli = async (args: string[]) => {
  try {
    const { input } = await parseCliRequest(args, ModuleFlowRenderInputSchema, {
      name: 'scripts/render-module-flow.ts',
      outputSchema: ModuleFlowRenderOutputSchema,
      help:
        `Examples:\n  bun scripts/render-module-flow.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"],"format":"json"}'\n` +
        `  bun scripts/render-module-flow.ts '{"files":["src/modules/ui-websocket-runtime-actor.ts"],"format":"mermaid"}'`,
    })

    const output = await renderModuleFlow(input)
    console.log(JSON.stringify(output, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}

if (import.meta.main) {
  await renderModuleFlowCli(Bun.argv.slice(2))
}
