import * as z from 'zod'

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'developer'])

export const MessageStatusSchema = z.enum(['in_progress', 'completed', 'incomplete'])

export const FunctionCallStatusSchema = z.enum(['in_progress', 'completed', 'incomplete'])

export const ToolChoiceValueEnumSchema = z.enum(['none', 'auto', 'required'])

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

export const InputTextContentSchema = z.object({
  type: z.literal('input_text'),
  text: z.string(),
})

export const InputImageContentSchema = z.object({
  type: z.literal('input_image'),
  image_url: z.string(),
})

export const OutputTextContentSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
})

export const RefusalContentSchema = z.object({
  type: z.literal('refusal'),
  refusal: z.string(),
})

/* ------------------------------------------------------------------ */
/*  Input items (sent by client)                                       */
/* ------------------------------------------------------------------ */

export const UserMessageItemParamSchema = z.object({
  type: z.literal('message'),
  role: z.literal('user'),
  content: z.union([z.array(InputTextContentSchema), z.string()]),
})

export const SystemMessageItemParamSchema = z.object({
  type: z.literal('message'),
  role: z.literal('system'),
  content: z.union([z.array(InputTextContentSchema), z.string()]),
})

export const AssistantMessageItemParamSchema = z.object({
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(z.union([OutputTextContentSchema, RefusalContentSchema])),
})

export const FunctionCallItemParamSchema = z.object({
  type: z.literal('function_call'),
  id: z.string(),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
})

export const FunctionCallOutputItemParamSchema = z.object({
  type: z.literal('function_call_output'),
  call_id: z.string(),
  output: z.string(),
})

export const ItemReferenceParamSchema = z.object({
  type: z.literal('item_reference'),
  id: z.string(),
})

/* ------------------------------------------------------------------ */
/*  Output items (returned by provider)                                */
/* ------------------------------------------------------------------ */

export const MessageItemSchema = z.object({
  type: z.literal('message'),
  id: z.string(),
  role: MessageRoleSchema,
  status: MessageStatusSchema,
  content: z.array(OutputTextContentSchema).optional(),
})

export const FunctionCallOutputSchema = z.object({
  type: z.literal('function_call_output'),
  id: z.string(),
  call_id: z.string(),
  output: z.string(),
  status: FunctionCallStatusSchema.optional(),
})

export const FunctionCallItemSchema = z.object({
  type: z.literal('function_call'),
  id: z.string(),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
  status: FunctionCallStatusSchema,
})

/* ------------------------------------------------------------------ */
/*  Tools                                                              */
/* ------------------------------------------------------------------ */

export const FunctionToolSchema = z.object({
  type: z.literal('function'),
  name: z.string(),
  description: z.string().optional(),
  parameters: z.any(),
})

export const ToolChoiceSpecificSchema = z.object({
  type: z.literal('function'),
  name: z.string(),
})

export const ToolChoiceSchema = z.union([ToolChoiceValueEnumSchema, ToolChoiceSpecificSchema])

/* ------------------------------------------------------------------ */
/*  Request / Response bodies                                          */
/* ------------------------------------------------------------------ */

export const CreateResponseBodySchema = z.object({
  model: z.string().optional(),
  input: z.union([
    z.string(),
    z.array(
      z.union([
        ItemReferenceParamSchema,
        UserMessageItemParamSchema,
        SystemMessageItemParamSchema,
        AssistantMessageItemParamSchema,
        FunctionCallItemParamSchema,
        FunctionCallOutputItemParamSchema,
      ]),
    ),
  ]),
  tools: z.array(FunctionToolSchema).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_output_tokens: z.number().optional(),
  stream: z.boolean().optional(),
  instructions: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export const ResponseResourceSchema = z.object({
  id: z.string(),
  object: z.literal('response'),
  status: z.string(),
  model: z.string(),
  output: z.array(z.union([MessageItemSchema, FunctionCallItemSchema, FunctionCallOutputSchema])),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
  created_at: z.number(),
})

/* ------------------------------------------------------------------ */
/*  Type exports                                                       */
/* ------------------------------------------------------------------ */

export type CreateResponseBodyOutput = z.output<typeof CreateResponseBodySchema>
export type ResponseResourceOutput = z.output<typeof ResponseResourceSchema>
export type FunctionToolOutput = z.output<typeof FunctionToolSchema>
export type ToolChoiceOutput = z.output<typeof ToolChoiceSchema>
export type ToolChoiceSpecificOutput = z.output<typeof ToolChoiceSpecificSchema>
