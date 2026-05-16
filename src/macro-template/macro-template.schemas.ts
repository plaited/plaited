import * as z from 'zod'

import { JsonObjectSchema } from '../behavioral.ts'

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[]

const MACRO_TAG_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i
const MACRO_ATTR_NAME_PATTERN = /^(?!on)[a-z_:][a-z0-9_.:-]*$/

/**
 * Human-readable dotted alias for a registered macro template.
 *
 * @remarks
 * Aliases are lowercase path-like names such as `ui.button.primary` and are
 * separate from content-addressed template refs.
 *
 * @public
 */
export const MacroTemplateAliasSchema = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/)

/**
 * Dotted macro template alias accepted by registration events.
 *
 * @public
 */
export type MacroTemplateAlias = z.output<typeof MacroTemplateAliasSchema>

/**
 * Content-addressed identifier for a macro template.
 *
 * @public
 */
export const MacroTemplateRefSchema = z.string().regex(/^template:sha256:[a-zA-Z0-9._:-]+$/)

/**
 * Template reference used by child template links and dependency reports.
 *
 * @public
 */
export type MacroTemplateRef = z.output<typeof MacroTemplateRefSchema>

/**
 * Replay-safe expression language for macro template data binding.
 *
 * @remarks
 * Expressions can read root data paths, read repeat variables, concatenate
 * values, compare values, branch conditionally, or embed JSON literals.
 *
 * @public
 */
export const MacroExpressionSchema: z.ZodType<MacroExpression> = z.lazy(() =>
  z.union([
    z.object({ literal: z.json() }),
    z.object({
      var: z.string().min(1),
      path: z.union([z.string(), z.array(z.string().min(1))]).optional(),
    }),
    z.object({ path: z.union([z.string(), z.array(z.string().min(1))]) }),
    z.object({ concat: z.array(MacroExpressionSchema).min(1) }),
    z.object({ equals: z.tuple([MacroExpressionSchema, MacroExpressionSchema]) }),
    z.object({
      if: z.object({
        condition: MacroExpressionSchema,
        thenValue: MacroExpressionSchema,
        elseValue: MacroExpressionSchema,
      }),
    }),
  ]),
)

/**
 * Data-binding expression that resolves against fixture data and repeat variables.
 *
 * @public
 */
export type MacroExpression =
  | { literal: JsonValue }
  | { path: string | string[] }
  | { var: string; path?: string | string[] }
  | { concat: MacroExpression[] }
  | { equals: [MacroExpression, MacroExpression] }
  | { if: { condition: MacroExpression; thenValue: MacroExpression; elseValue: MacroExpression } }

/**
 * Safe element tag name accepted before rendering.
 *
 * @public
 */
export const MacroTagNameSchema = z.string().regex(MACRO_TAG_NAME_PATTERN, 'Expected a safe macro tag name')

/**
 * Element tag name accepted by macro nodes.
 *
 * @public
 */
export type MacroTagName = z.output<typeof MacroTagNameSchema>

/**
 * Safe lowercase attribute name accepted before rendering.
 *
 * @remarks
 * The structural pattern rejects `on*` event handler attributes so the emitted
 * JSON schema exposes that admission constraint to replay and exploration tools.
 *
 * @public
 */
export const MacroAttrNameSchema = z.string().regex(MACRO_ATTR_NAME_PATTERN, 'Expected a safe macro attribute name')

/**
 * Attribute name accepted by macro element nodes.
 *
 * @public
 */
export type MacroAttrName = z.output<typeof MacroAttrNameSchema>

/**
 * Attribute expression map for a macro element node.
 *
 * @remarks
 * Attribute names are structurally screened here. Reserved renderer props such
 * as `children`, `style`, `classNames`, and `stylesheets` are rejected during
 * compiler admission so validation events can report repairable failures.
 *
 * @public
 */
export const MacroAttrsSchema = z.record(MacroAttrNameSchema, MacroExpressionSchema)

/**
 * Macro element attribute expressions indexed by safe attribute name.
 *
 * @public
 */
export type MacroAttrs = z.output<typeof MacroAttrsSchema>

const MacroStyleValueSchema: z.ZodType<MacroStyleValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.object({ token: z.string().min(1) }),
    z.record(z.string(), MacroStyleValueSchema),
  ]),
)

/**
 * Style declaration value supported by macro style classes.
 *
 * @remarks
 * Values may be primitives, nested style objects, or references to design tokens
 * declared in the same macro template.
 *
 * @public
 */
export type MacroStyleValue = string | number | { token: string } | { [key: string]: MacroStyleValue }

/**
 * Design tokens and CSS classes available to a macro template.
 *
 * @public
 */
export const MacroStylesSchema = z.object({
  tokens: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  classes: z.record(z.string(), z.record(z.string(), MacroStyleValueSchema)).optional(),
})

/**
 * Structured macro styles compiled through the UI CSS helpers.
 *
 * @public
 */
export type MacroStyles = z.output<typeof MacroStylesSchema>

/**
 * Macro template abstract syntax tree node.
 *
 * @remarks
 * Nodes may render text, repeat child nodes over data, include a child template,
 * or render an element. Repeat nodes require an explicit key so repeated
 * triggers can expose stable data attributes.
 *
 * @public
 */
export const MacroNodeSchema: z.ZodType<MacroNode> = z.lazy(() =>
  z.union([
    z.object({
      text: MacroExpressionSchema,
    }),
    z.object({
      repeat: z.object({
        items: MacroExpressionSchema,
        var: z.string().min(1),
        key: MacroExpressionSchema,
        children: z.array(MacroNodeSchema).min(1),
      }),
    }),
    z.object({
      templateRef: MacroTemplateRefSchema,
      data: z.record(z.string(), MacroExpressionSchema).optional(),
    }),
    z.object({
      tag: MacroTagNameSchema,
      attrs: MacroAttrsSchema.optional(),
      styles: z.array(z.string().min(1)).optional(),
      children: z.array(MacroNodeSchema).optional(),
    }),
  ]),
)

/**
 * Macro template node used by the compiler.
 *
 * @public
 */
export type MacroNode =
  | {
      text: MacroExpression
    }
  | {
      repeat: {
        items: MacroExpression
        var: string
        key: MacroExpression
        children: MacroNode[]
      }
    }
  | {
      templateRef: MacroTemplateRef
      data?: Record<string, MacroExpression>
    }
  | {
      tag: MacroTagName
      attrs?: MacroAttrs
      styles?: string[]
      children?: MacroNode[]
    }

/**
 * Complete macro template registration payload.
 *
 * @remarks
 * A template combines a stable alias, a content-addressed ref, optional styles
 * and metadata, and the root macro node that will compile to a render template.
 *
 * @public
 */
export const MacroTemplateSchema = z.object({
  alias: MacroTemplateAliasSchema,
  ref: MacroTemplateRefSchema,
  styles: MacroStylesSchema.optional(),
  node: MacroNodeSchema,
  metadata: JsonObjectSchema.optional(),
})

/**
 * Macro template definition accepted by compiler and registration APIs.
 *
 * @public
 */
export type MacroTemplate = z.output<typeof MacroTemplateSchema>

/**
 * Input required to compile a macro template into a render template object.
 *
 * @remarks
 * Child templates are supplied by ref so `templateRef` nodes can be resolved
 * without reaching outside the replayed input.
 *
 * @public
 */
export const CompileMacroTemplateInputSchema = z.object({
  template: MacroTemplateSchema,
  templates: z.record(MacroTemplateRefSchema, MacroTemplateSchema).optional(),
  data: JsonObjectSchema.optional(),
})

/**
 * Macro compiler input with root template, optional child templates, and data.
 *
 * @public
 */
export type CompileMacroTemplateInput = z.output<typeof CompileMacroTemplateInputSchema>

/**
 * Runtime value produced by resolving a macro expression.
 *
 * @public
 */
export type MacroExpressionValue = z.output<typeof JsonPrimitiveSchema> | JsonObject | MacroExpressionValue[]

/**
 * Requests admission and validation for a macro template registration.
 *
 * @public
 */
export const UiTemplateRegistrationRequestedEventSchema = z.object({
  type: z.literal('ui.template_registration_requested'),
  detail: z.object({
    template: MacroTemplateSchema,
    templates: z.record(MacroTemplateRefSchema, MacroTemplateSchema).optional(),
    fixtureData: JsonObjectSchema.optional(),
  }),
})

/**
 * Event payload submitted when a macro template should be validated and registered.
 *
 * @public
 */
export type UiTemplateRegistrationRequestedEvent = z.output<typeof UiTemplateRegistrationRequestedEventSchema>

/**
 * Reports a macro template that passed admission and compile-time validation.
 *
 * @remarks
 * The event includes dependency refs and a render validation payload so consumers
 * can cache both the accepted template and the assets produced by compilation.
 *
 * @public
 */
export const UiTemplateRegisteredEventSchema = z.object({
  type: z.literal('ui.template_registered'),
  detail: z.object({
    alias: MacroTemplateAliasSchema,
    ref: MacroTemplateRefSchema,
    template: MacroTemplateSchema,
    dependencyRefs: z.array(MacroTemplateRefSchema),
    validation: z.object({
      html: z.string(),
      stylesheets: z.array(z.string()),
      registry: z.array(z.string()),
    }),
  }),
})

/**
 * Event emitted for a successfully admitted macro template registration.
 *
 * @public
 */
export type UiTemplateRegisteredEvent = z.output<typeof UiTemplateRegisteredEventSchema>

/**
 * Reports a repairable macro template registration failure.
 *
 * @public
 */
export const UiTemplateValidationFailedEventSchema = z.object({
  type: z.literal('ui.template_validation_failed'),
  detail: z.object({
    alias: MacroTemplateAliasSchema.optional(),
    ref: MacroTemplateRefSchema.optional(),
    repairable: z.literal(true),
    error: z.object({
      message: z.string(),
    }),
  }),
})

/**
 * Event emitted when macro template validation fails before registration.
 *
 * @public
 */
export type UiTemplateValidationFailedEvent = z.output<typeof UiTemplateValidationFailedEventSchema>

/**
 * Result event produced by macro template registration validation.
 *
 * @public
 */
export const UiTemplateValidationEventSchema = z.discriminatedUnion('type', [
  UiTemplateRegisteredEventSchema,
  UiTemplateValidationFailedEventSchema,
])

/**
 * Successful or repairable-failure result for a macro template registration request.
 *
 * @public
 */
export type UiTemplateValidationEvent = z.output<typeof UiTemplateValidationEventSchema>

type JsonObject = z.output<typeof JsonObjectSchema>
