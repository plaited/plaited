import type { CreateParams, DesignTokenGroup, DesignTokenReference } from '../css/css.types.ts'
import { createStyles } from '../css/styles.ts'
import { createTokens } from '../css/tokens.ts'
import { ssr } from '../render/ssr.ts'
import { createTemplate, Fragment } from '../render/template.ts'
import type { Child, TemplateObject } from '../render/template.types.ts'
import {
  type CompileMacroTemplateInput,
  CompileMacroTemplateInputSchema,
  type MacroExpression,
  type MacroExpressionValue,
  type MacroNode,
  type MacroStyleValue,
  type MacroTemplateRef,
  type UiTemplateRegistrationRequestedEvent,
  UiTemplateRegistrationRequestedEventSchema,
  type UiTemplateValidationEvent,
} from './macro-template.schemas.ts'

const RESERVED_MACRO_ATTR_NAMES = new Set(['children', 'classnames', 'style', 'stylesheets'])

const toPath = (path: string | string[]): string[] => (Array.isArray(path) ? path : path.split('.').filter(Boolean))

const readPath = ({ source, path }: { source: unknown; path: string | string[] }): unknown => {
  let current = source
  for (const segment of toPath(path)) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, segment)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

const resolveExpression = ({
  expression,
  data,
  vars = {},
}: {
  expression: MacroExpression
  data: Record<string, unknown>
  vars?: Record<string, unknown>
}): MacroExpressionValue | undefined => {
  if ('literal' in expression) return expression.literal as MacroExpressionValue
  if ('var' in expression) {
    const value = vars[expression.var]
    return expression.path
      ? (readPath({ source: value, path: expression.path }) as MacroExpressionValue | undefined)
      : (value as MacroExpressionValue)
  }
  if ('path' in expression) return readPath({ source: data, path: expression.path }) as MacroExpressionValue | undefined
  if ('concat' in expression) {
    return expression.concat.map((item) => resolveExpression({ expression: item, data, vars }) ?? '').join('')
  }
  if ('equals' in expression) {
    const [left, right] = expression.equals
    return resolveExpression({ expression: left, data, vars }) === resolveExpression({ expression: right, data, vars })
  }
  return resolveExpression({ expression: expression.if.condition, data, vars })
    ? resolveExpression({ expression: expression.if.thenValue, data, vars })
    : resolveExpression({ expression: expression.if.elseValue, data, vars })
}

const toTemplateChild = (value: TemplateObject | MacroExpressionValue | undefined): Child | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && '$' in value) return value as TemplateObject
  return String(value)
}

const isPrimitiveAttributeValue = (value: unknown): value is string | number | boolean | null | undefined => {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

const isRepeatKeyValue = (value: unknown): value is string | number | boolean => {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

const isTriggerMap = (value: unknown): value is Record<string, string> => {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        key.length > 0 && !/[\s:]/.test(key) && typeof item === 'string' && item.length > 0 && !/\s/.test(item),
    )
  )
}

const isReusableTopicExpression = ({
  expression,
  reusableVars,
}: {
  expression: MacroExpression
  reusableVars: Set<string>
}): boolean => {
  if ('var' in expression) return reusableVars.has(expression.var)
  if ('path' in expression) return true
  return false
}

const getPathRoot = (path: string | string[]): string | undefined => toPath(path)[0]

const collectExpressionDataKeys = ({
  expression,
  varDataKeys,
}: {
  expression: MacroExpression
  varDataKeys: Map<string, Set<string>>
}): Set<string> => {
  if ('var' in expression) return new Set(varDataKeys.get(expression.var) ?? [expression.var])
  if ('path' in expression) {
    const key = getPathRoot(expression.path)
    return key ? new Set([key]) : new Set()
  }
  return new Set()
}

const collectTopicDataKeys = ({
  node,
  templates,
  keys,
  varDataKeys = new Map<string, Set<string>>(),
  stack = [],
}: {
  node: MacroNode
  templates: CompileMacroTemplateInput['templates']
  keys: Set<string>
  varDataKeys?: Map<string, Set<string>>
  stack?: MacroTemplateRef[]
}): Set<string> => {
  if ('repeat' in node) {
    const nextVarDataKeys = new Map(varDataKeys)
    nextVarDataKeys.set(node.repeat.var, collectExpressionDataKeys({ expression: node.repeat.items, varDataKeys }))
    for (const child of node.repeat.children) {
      collectTopicDataKeys({ node: child, templates, keys, varDataKeys: nextVarDataKeys, stack })
    }
    return keys
  }
  if ('templateRef' in node) {
    if (stack.includes(node.templateRef)) {
      throw new Error(`Macro templateRef cycle detected: ${[...stack, node.templateRef].join(' -> ')}`)
    }
    const template = templates?.[node.templateRef]
    if (!template) throw new Error(`Unknown macro child template ref: ${node.templateRef}`)
    const childKeys = collectTopicDataKeys({
      node: template.node,
      templates,
      keys: new Set<string>(),
      stack: [...stack, node.templateRef],
    })
    for (const key of childKeys) {
      const expression = node.data?.[key]
      if (expression) {
        const dataKeys = collectExpressionDataKeys({ expression, varDataKeys })
        if (dataKeys.size > 0) {
          for (const dataKey of dataKeys) keys.add(dataKey)
        } else {
          keys.add(key)
        }
      } else {
        keys.add(key)
      }
    }
    return keys
  }
  if ('text' in node) return keys

  const topic = node.attrs?.['p-topic']
  if (topic) {
    for (const key of collectExpressionDataKeys({ expression: topic, varDataKeys })) keys.add(key)
  }
  for (const child of node.children ?? []) collectTopicDataKeys({ node: child, templates, keys, varDataKeys, stack })
  return keys
}

const validateResolvedAttr = ({ key, value }: { key: string; value: unknown }) => {
  if (RESERVED_MACRO_ATTR_NAMES.has(key.toLowerCase())) {
    throw new Error(`Macro attribute '${key}' is reserved`)
  }
  if (key === 'p-trigger') {
    if (!isTriggerMap(value)) throw new Error('Macro p-trigger attr must resolve to an event map')
    return
  }
  if (key === 'p-topic') {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error('Macro p-topic attr must resolve to a non-empty string')
    }
    return
  }
  if (!isPrimitiveAttributeValue(value)) {
    throw new Error(`Macro attribute '${key}' must resolve to a primitive value`)
  }
}

type MacroCompileContext = {
  styles: Record<string, { classNames: string[]; stylesheets: string[] }>
  templates: CompileMacroTemplateInput['templates']
  sessionLocal: boolean
  templateStack: MacroTemplateRef[]
}

const readTokenReference = ({
  references,
  path,
}: {
  references: Record<string, unknown>
  path: string
}): DesignTokenReference => {
  const value = readPath({ source: references, path })
  if (typeof value !== 'function' || !('stylesheets' in value)) {
    throw new Error(`Unknown macro token reference: ${path}`)
  }
  return value as DesignTokenReference
}

const resolveStyleValue = ({
  value,
  references,
}: {
  value: MacroStyleValue
  references: Record<string, unknown>
}): unknown => {
  if (typeof value === 'string' || typeof value === 'number') return value
  if ('token' in value && typeof value.token === 'string') return readTokenReference({ references, path: value.token })
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, resolveStyleValue({ value: item, references })]),
  )
}

const createStyleContext = ({
  template,
  templates,
}: {
  template: CompileMacroTemplateInput['template']
  templates?: CompileMacroTemplateInput['templates']
}): MacroCompileContext => {
  const references: Record<string, unknown> = {}
  for (const [ident, group] of Object.entries(template.styles?.tokens ?? {})) {
    Object.assign(references, createTokens(ident, group as DesignTokenGroup))
  }
  const classes = Object.fromEntries(
    Object.entries(template.styles?.classes ?? {}).map(([name, rules]) => [
      name,
      Object.fromEntries(
        Object.entries(rules).map(([prop, value]) => [prop, resolveStyleValue({ value, references })]),
      ),
    ]),
  ) as CreateParams
  return {
    styles: createStyles(classes),
    templates,
    sessionLocal: template.metadata?.sessionLocal === true,
    templateStack: [template.ref],
  }
}

const compileNode = ({
  node,
  data,
  vars,
  reusableVars,
  repeatKey,
  context,
}: {
  node: MacroNode
  data: Record<string, unknown>
  vars: Record<string, unknown>
  reusableVars: Set<string>
  repeatKey?: MacroExpressionValue
  context: MacroCompileContext
}): Child | undefined => {
  if ('text' in node) {
    return toTemplateChild(resolveExpression({ expression: node.text, data, vars }))
  }

  if ('repeat' in node) {
    const items = resolveExpression({ expression: node.repeat.items, data, vars })
    if (!Array.isArray(items)) return undefined
    const children = items.flatMap<Child>((item) => {
      const nextVars = { ...vars, [node.repeat.var]: item }
      const nextReusableVars = new Set(reusableVars)
      if (isReusableTopicExpression({ expression: node.repeat.items, reusableVars })) {
        nextReusableVars.add(node.repeat.var)
      } else {
        nextReusableVars.delete(node.repeat.var)
      }
      const nextRepeatKey = resolveExpression({ expression: node.repeat.key, data, vars: nextVars })
      if (!isRepeatKeyValue(nextRepeatKey)) throw new Error('repeat key must resolve to a primitive value')
      return node.repeat.children
        .map((child) =>
          compileNode({
            node: child,
            data,
            vars: nextVars,
            reusableVars: nextReusableVars,
            repeatKey: nextRepeatKey,
            context,
          }),
        )
        .filter((child): child is Child => child !== undefined)
    })
    return Fragment({ children })
  }

  if ('templateRef' in node) {
    const template = context.templates?.[node.templateRef]
    if (!template) throw new Error(`Unknown macro child template ref: ${node.templateRef}`)
    if (context.templateStack.includes(node.templateRef)) {
      throw new Error(`Macro templateRef cycle detected: ${[...context.templateStack, node.templateRef].join(' -> ')}`)
    }
    if (!context.sessionLocal && template.metadata?.sessionLocal !== true) {
      const topicDataKeys = collectTopicDataKeys({
        node: template.node,
        templates: context.templates,
        keys: new Set(),
        stack: [...context.templateStack, node.templateRef],
      })
      for (const key of topicDataKeys) {
        const expression = node.data?.[key]
        if (expression && !isReusableTopicExpression({ expression, reusableVars })) {
          throw new Error('Reusable macro templates must bind child p-topic data from data')
        }
      }
    }
    const childData = Object.fromEntries(
      Object.entries(node.data ?? {}).map(([key, expression]) => [key, resolveExpression({ expression, data, vars })]),
    )
    const childContext = createStyleContext({ template, templates: context.templates })
    return compileNode({
      node: template.node,
      data: childData,
      vars: {},
      reusableVars: new Set(Object.keys(childData)),
      repeatKey,
      context: {
        ...childContext,
        templateStack: [...context.templateStack, node.templateRef],
      },
    })
  }

  const attrs: Record<string, unknown> = {}
  if (
    !context.sessionLocal &&
    node.attrs?.['p-topic'] &&
    !isReusableTopicExpression({ expression: node.attrs['p-topic'], reusableVars })
  ) {
    throw new Error('Reusable macro templates must bind p-topic from data')
  }
  for (const [key, expression] of Object.entries(node.attrs ?? {})) {
    const value = resolveExpression({ expression, data, vars })
    validateResolvedAttr({ key, value })
    attrs[key] = value
  }
  for (const style of node.styles ?? []) {
    const compiledStyle = context.styles[style]
    if (!compiledStyle) throw new Error(`Unknown macro style: ${style}`)
    attrs.classNames = [...((attrs.classNames as string[] | undefined) ?? []), ...compiledStyle.classNames]
    attrs.stylesheets = [...((attrs.stylesheets as string[] | undefined) ?? []), ...compiledStyle.stylesheets]
  }
  if (repeatKey !== undefined && attrs['p-trigger']) {
    const exposesKey = Object.entries(attrs).some(([key, value]) => key.startsWith('data-') && value === repeatKey)
    if (!exposesKey) throw new Error('repeated p-trigger element must expose repeat key through a data-* attr')
  }

  const children = (node.children ?? [])
    .map((child) => compileNode({ node: child, data, vars, reusableVars, repeatKey, context }))
    .filter((child): child is Child => child !== undefined)

  return createTemplate(node.tag, {
    ...attrs,
    children,
  })
}

/**
 * Compiles a macro template input into a render template object.
 *
 * @remarks
 * Compilation validates the replay-visible macro schema, resolves child
 * template refs, compiles structured styles, enforces reusable `p-topic`
 * provenance, and rejects unsafe tags, attributes, triggers, repeat keys, and
 * template-ref cycles before the renderer receives the template.
 *
 * @public
 */
export const compileMacroTemplate = (input: CompileMacroTemplateInput): TemplateObject => {
  const parsed = CompileMacroTemplateInputSchema.parse(input)
  const context = createStyleContext({ template: parsed.template, templates: parsed.templates })
  const compiled = compileNode({
    node: parsed.template.node,
    data: parsed.data ?? {},
    vars: {},
    reusableVars: new Set(Object.keys(parsed.data ?? {})),
    context,
  })
  if (!compiled || typeof compiled !== 'object' || !('$' in compiled)) {
    throw new Error('Macro template root must compile to a template object')
  }
  return compiled
}

/**
 * Renders a compiled macro template to server-side HTML.
 *
 * @public
 */
export const renderMacroTemplate = ({ template }: { template: TemplateObject }): string => ssr([template])

const collectDependencyRefs = ({
  node,
  templates,
  refs,
  stack = [],
}: {
  node: MacroNode
  templates: CompileMacroTemplateInput['templates']
  refs: Set<MacroTemplateRef>
  stack?: MacroTemplateRef[]
}) => {
  if ('templateRef' in node) {
    if (stack.includes(node.templateRef)) {
      throw new Error(`Macro templateRef cycle detected: ${[...stack, node.templateRef].join(' -> ')}`)
    }
    refs.add(node.templateRef)
    const template = templates?.[node.templateRef]
    if (template) collectDependencyRefs({ node: template.node, templates, refs, stack: [...stack, node.templateRef] })
    return
  }
  if ('repeat' in node) {
    for (const child of node.repeat.children) collectDependencyRefs({ node: child, templates, refs, stack })
    return
  }
  if ('children' in node) {
    for (const child of node.children ?? []) collectDependencyRefs({ node: child, templates, refs, stack })
  }
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const getRawRegistrationIdentity = (event: UiTemplateRegistrationRequestedEvent): { alias?: string; ref?: string } => {
  const template = (event as { detail?: { template?: { alias?: unknown; ref?: unknown } } }).detail?.template
  return {
    ...(typeof template?.alias === 'string' && { alias: template.alias }),
    ...(typeof template?.ref === 'string' && { ref: template.ref }),
  }
}

/**
 * Validates a macro template registration request and returns its admission event.
 *
 * @remarks
 * Successful validation compiles the template with fixture data, renders it once,
 * reports dependency refs, and returns the generated style registry. Schema or
 * compiler failures become repairable validation-failed events that preserve any
 * raw alias or ref available in the submitted request.
 *
 * @public
 */
export const validateMacroTemplateRegistration = (
  event: UiTemplateRegistrationRequestedEvent,
): UiTemplateValidationEvent => {
  const parsed = UiTemplateRegistrationRequestedEventSchema.safeParse(event)
  if (!parsed.success) {
    return {
      type: 'ui.template_validation_failed',
      detail: {
        ...getRawRegistrationIdentity(event),
        repairable: true,
        error: {
          message: parsed.error.message,
        },
      },
    }
  }

  try {
    const template = compileMacroTemplate({
      template: parsed.data.detail.template,
      templates: parsed.data.detail.templates,
      data: parsed.data.detail.fixtureData,
    })
    const refs = new Set<MacroTemplateRef>()
    collectDependencyRefs({
      node: parsed.data.detail.template.node,
      templates: parsed.data.detail.templates,
      refs,
      stack: [parsed.data.detail.template.ref],
    })
    return {
      type: 'ui.template_registered',
      detail: {
        alias: parsed.data.detail.template.alias,
        ref: parsed.data.detail.template.ref,
        template: parsed.data.detail.template,
        dependencyRefs: [...refs],
        validation: {
          html: renderMacroTemplate({ template }),
          stylesheets: template.stylesheets,
          registry: template.registry,
        },
      },
    }
  } catch (error) {
    return {
      type: 'ui.template_validation_failed',
      detail: {
        alias: parsed.data.detail.template.alias,
        ref: parsed.data.detail.template.ref,
        repairable: true,
        error: {
          message: getErrorMessage(error),
        },
      },
    }
  }
}
