import * as z from 'zod'

import { JsonObjectSchema } from '../behavioral.ts'

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[]

const MACRO_TAG_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i
const MACRO_ATTR_NAME_PATTERN = /^(?!on)[a-z_:][a-z0-9_.:-]*$/

/** @public */
export const MacroTemplateAliasSchema = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/)

/** @public */
export type MacroTemplateAlias = z.output<typeof MacroTemplateAliasSchema>

/** @public */
export const MacroTemplateRefSchema = z.string().regex(/^template:sha256:[a-zA-Z0-9._:-]+$/)

/** @public */
export type MacroTemplateRef = z.output<typeof MacroTemplateRefSchema>

/** @public */
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

/** @public */
export type MacroExpression =
  | { literal: JsonValue }
  | { path: string | string[] }
  | { var: string; path?: string | string[] }
  | { concat: MacroExpression[] }
  | { equals: [MacroExpression, MacroExpression] }
  | { if: { condition: MacroExpression; thenValue: MacroExpression; elseValue: MacroExpression } }

/** @public */
export const MacroTagNameSchema = z.string().regex(MACRO_TAG_NAME_PATTERN, 'Expected a safe macro tag name')

/** @public */
export type MacroTagName = z.output<typeof MacroTagNameSchema>

/** @public */
export const MacroAttrNameSchema = z.string().regex(MACRO_ATTR_NAME_PATTERN, 'Expected a safe macro attribute name')

/** @public */
export type MacroAttrName = z.output<typeof MacroAttrNameSchema>

/** @public */
export const MacroAttrsSchema = z.record(MacroAttrNameSchema, MacroExpressionSchema)

/** @public */
export type MacroAttrs = z.output<typeof MacroAttrsSchema>

const MacroStyleValueSchema: z.ZodType<MacroStyleValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.object({ token: z.string().min(1) }),
    z.record(z.string(), MacroStyleValueSchema),
  ]),
)

/** @public */
export type MacroStyleValue = string | number | { token: string } | { [key: string]: MacroStyleValue }

/** @public */
export const MacroStylesSchema = z.object({
  tokens: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  classes: z.record(z.string(), z.record(z.string(), MacroStyleValueSchema)).optional(),
})

/** @public */
export type MacroStyles = z.output<typeof MacroStylesSchema>

/** @public */
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

/** @public */
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

/** @public */
export const MacroTemplateSchema = z.object({
  alias: MacroTemplateAliasSchema,
  ref: MacroTemplateRefSchema,
  styles: MacroStylesSchema.optional(),
  node: MacroNodeSchema,
  metadata: JsonObjectSchema.optional(),
})

/** @public */
export type MacroTemplate = z.output<typeof MacroTemplateSchema>

/** @public */
export const CompileMacroTemplateInputSchema = z.object({
  template: MacroTemplateSchema,
  templates: z.record(MacroTemplateRefSchema, MacroTemplateSchema).optional(),
  data: JsonObjectSchema.optional(),
})

/** @public */
export type CompileMacroTemplateInput = z.output<typeof CompileMacroTemplateInputSchema>

/** @public */
export type MacroExpressionValue = z.output<typeof JsonPrimitiveSchema> | JsonObject | MacroExpressionValue[]

/** @public */
export const UiTemplateRegistrationRequestedEventSchema = z.object({
  type: z.literal('ui.template_registration_requested'),
  detail: z.object({
    template: MacroTemplateSchema,
    templates: z.record(MacroTemplateRefSchema, MacroTemplateSchema).optional(),
    fixtureData: JsonObjectSchema.optional(),
  }),
})

/** @public */
export type UiTemplateRegistrationRequestedEvent = z.output<typeof UiTemplateRegistrationRequestedEventSchema>

/** @public */
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

/** @public */
export type UiTemplateRegisteredEvent = z.output<typeof UiTemplateRegisteredEventSchema>

/** @public */
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

/** @public */
export type UiTemplateValidationFailedEvent = z.output<typeof UiTemplateValidationFailedEventSchema>

/** @public */
export const UiTemplateValidationEventSchema = z.discriminatedUnion('type', [
  UiTemplateRegisteredEventSchema,
  UiTemplateValidationFailedEventSchema,
])

/** @public */
export type UiTemplateValidationEvent = z.output<typeof UiTemplateValidationEventSchema>

type JsonObject = z.output<typeof JsonObjectSchema>
