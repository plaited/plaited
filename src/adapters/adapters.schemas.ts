import * as z from 'zod'

import { JsonObjectSchema } from '../behavioral/behavioral.schemas.ts'

const ADAPTER_RUNTIME_ROLES = ['analyst', 'coder'] as const

export const AdapterRuntimeRoleSchema = z
  .enum(ADAPTER_RUNTIME_ROLES)
  .describe('Runtime lane for local offline adapters.')

export type AdapterRuntimeRole = z.output<typeof AdapterRuntimeRoleSchema>

export const AdapterRuntimeRoleJsonSchema = {
  type: 'string',
  enum: ADAPTER_RUNTIME_ROLES,
} as const

const ADAPTER_MULTIMODAL_CONTENT_TYPES = ['text', 'image_url', 'video_url', 'audio_url'] as const

export const AdapterMultimodalContentPartJsonSchema = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ADAPTER_MULTIMODAL_CONTENT_TYPES },
    text: { type: 'string', minLength: 1 },
    image_url: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', minLength: 1 },
      },
      additionalProperties: true,
    },
    video_url: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', minLength: 1 },
      },
      additionalProperties: true,
    },
    audio_url: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', minLength: 1 },
      },
      additionalProperties: true,
    },
  },
  oneOf: [
    {
      properties: { type: { const: 'text' } },
      required: ['text'],
    },
    {
      properties: { type: { const: 'image_url' } },
      required: ['image_url'],
    },
    {
      properties: { type: { const: 'video_url' } },
      required: ['video_url'],
    },
    {
      properties: { type: { const: 'audio_url' } },
      required: ['audio_url'],
    },
  ],
  additionalProperties: false,
} as const

export const AdapterMultimodalContentPartSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('text'),
        text: z.string().min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal('image_url'),
        image_url: z
          .object({
            url: z.string().min(1),
          })
          .passthrough(),
      })
      .strict(),
    z
      .object({
        type: z.literal('video_url'),
        video_url: z
          .object({
            url: z.string().min(1),
          })
          .passthrough(),
      })
      .strict(),
    z
      .object({
        type: z.literal('audio_url'),
        audio_url: z
          .object({
            url: z.string().min(1),
          })
          .passthrough(),
      })
      .strict(),
  ])
  .describe('One multimodal content part for chat messages.')

export type AdapterMultimodalContentPart = z.output<typeof AdapterMultimodalContentPartSchema>

const ADAPTER_CHAT_ROLES = ['system', 'user', 'assistant', 'tool'] as const

export const AdapterVllmChatMessageJsonSchema = {
  type: 'object',
  required: ['role', 'content'],
  properties: {
    role: { type: 'string', enum: ADAPTER_CHAT_ROLES },
    content: {
      oneOf: [
        { type: 'string', minLength: 1 },
        {
          type: 'array',
          minItems: 1,
          items: AdapterMultimodalContentPartJsonSchema,
        },
      ],
    },
    tool_call_id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

export const AdapterVllmChatMessageSchema = z
  .object({
    role: z.enum(ADAPTER_CHAT_ROLES),
    content: z.union([z.string().min(1), z.array(AdapterMultimodalContentPartSchema).min(1)]),
    tool_call_id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .strict()
  .describe('Chat message contract for adapter infer chat mode.')

export type AdapterVllmChatMessage = z.output<typeof AdapterVllmChatMessageSchema>

export const AdapterVllmToolDefinitionJsonSchema = {
  type: 'object',
  required: ['type', 'function'],
  properties: {
    type: { const: 'function' },
    function: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        parameters: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const

export const AdapterVllmToolDefinitionSchema = z
  .object({
    type: z.literal('function'),
    function: z
      .object({
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        parameters: JsonObjectSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Tool declaration entry forwarded to vLLM chat mode.')

export type AdapterVllmToolDefinition = z.output<typeof AdapterVllmToolDefinitionSchema>

const ADAPTER_REASONING_MODES = ['default', 'thinking', 'no_thinking'] as const

export const AdapterVllmInferDetailJsonSchema = {
  type: 'object',
  required: ['runtime'],
  properties: {
    runtime: AdapterRuntimeRoleJsonSchema,
    autoInit: { type: 'boolean' },
    useTqdm: { type: 'boolean' },
    thinking: { type: 'boolean' },
    reasoningMode: { type: 'string', enum: ADAPTER_REASONING_MODES },
    prompt: { type: 'string', minLength: 1 },
    prompts: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
    },
    inputs: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', additionalProperties: true },
    },
    messages: {
      type: 'array',
      minItems: 1,
      items: AdapterVllmChatMessageJsonSchema,
    },
    tools: {
      type: 'array',
      items: AdapterVllmToolDefinitionJsonSchema,
    },
    sampling: { type: 'object', additionalProperties: true },
    chatTemplateKwargs: { type: 'object', additionalProperties: true },
  },
  anyOf: [{ required: ['prompt'] }, { required: ['prompts'] }, { required: ['inputs'] }, { required: ['messages'] }],
  additionalProperties: false,
} as const

const AdapterVllmInferDetailBaseSchema = z
  .object({
    runtime: AdapterRuntimeRoleSchema,
    autoInit: z.boolean().optional(),
    useTqdm: z.boolean().optional(),
    thinking: z.boolean().optional(),
    reasoningMode: z.enum(ADAPTER_REASONING_MODES).optional(),
    prompt: z.string().min(1).optional(),
    prompts: z.array(z.string().min(1)).min(1).optional(),
    inputs: z.array(JsonObjectSchema).min(1).optional(),
    messages: z.array(AdapterVllmChatMessageSchema).min(1).optional(),
    tools: z.array(AdapterVllmToolDefinitionSchema).optional(),
    sampling: JsonObjectSchema.optional(),
    chatTemplateKwargs: JsonObjectSchema.optional(),
  })
  .strict()

const AdapterVllmInferDetailInputRequirementSchema = z.union([
  z.object({ prompt: z.string().min(1) }).passthrough(),
  z.object({ prompts: z.array(z.string().min(1)).min(1) }).passthrough(),
  z.object({ inputs: z.array(JsonObjectSchema).min(1) }).passthrough(),
  z.object({ messages: z.array(AdapterVllmChatMessageSchema).min(1) }).passthrough(),
])

export const AdapterVllmInferDetailSchema = AdapterVllmInferDetailBaseSchema.and(
  AdapterVllmInferDetailInputRequirementSchema,
).describe('Infer detail for text, multimodal, and tool-calling execution.')

export type AdapterVllmInferDetail = z.output<typeof AdapterVllmInferDetailSchema>

export const AdapterVllmInferRequestJsonSchema = {
  type: 'object',
  required: ['type', 'detail'],
  properties: {
    type: { const: 'infer' },
    detail: AdapterVllmInferDetailJsonSchema,
  },
  additionalProperties: false,
} as const

export const AdapterVllmInferRequestSchema = z
  .object({
    type: z.literal('infer'),
    detail: AdapterVllmInferDetailSchema,
  })
  .strict()
  .describe('Infer request envelope for the vLLM Python adapter.')

export type AdapterVllmInferRequest = z.output<typeof AdapterVllmInferRequestSchema>

export const AdapterToolExecutionDetailJsonSchema = {
  type: 'object',
  required: ['taskId', 'runtime', 'toolCallId', 'toolName', 'arguments'],
  properties: {
    taskId: { type: 'string', minLength: 1 },
    runtime: AdapterRuntimeRoleJsonSchema,
    toolCallId: { type: 'string', minLength: 1 },
    toolName: { type: 'string', minLength: 1 },
    arguments: { type: 'string' },
  },
  additionalProperties: false,
} as const

export const AdapterToolExecutionEventJsonSchema = {
  type: 'object',
  required: ['type', 'detail'],
  properties: {
    type: { const: 'tool_execution' },
    detail: AdapterToolExecutionDetailJsonSchema,
  },
  additionalProperties: false,
} as const

export const AdapterToolExecutionEventSchema = z
  .object({
    type: z.literal('tool_execution'),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: AdapterRuntimeRoleSchema,
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        arguments: z.string(),
      })
      .strict(),
  })
  .strict()
  .describe('Tool execution intent event emitted before running a tool.')

export type AdapterToolExecutionEvent = z.output<typeof AdapterToolExecutionEventSchema>

export const AdapterToolResultDetailJsonSchema = {
  type: 'object',
  required: ['taskId', 'runtime', 'toolCallId', 'toolName', 'ok'],
  properties: {
    taskId: { type: 'string', minLength: 1 },
    runtime: AdapterRuntimeRoleJsonSchema,
    toolCallId: { type: 'string', minLength: 1 },
    toolName: { type: 'string', minLength: 1 },
    ok: { type: 'boolean' },
    result: { type: 'object', additionalProperties: true },
    error: { type: 'string', minLength: 1 },
  },
  oneOf: [
    {
      properties: { ok: { const: true } },
      required: ['result'],
      not: { required: ['error'] },
    },
    {
      properties: { ok: { const: false } },
      required: ['error'],
      not: { required: ['result'] },
    },
  ],
  additionalProperties: false,
} as const

export const AdapterToolResultEventJsonSchema = {
  type: 'object',
  required: ['type', 'detail'],
  properties: {
    type: { const: 'tool_result' },
    detail: AdapterToolResultDetailJsonSchema,
  },
  additionalProperties: false,
} as const

const AdapterToolResultDetailBaseSchema = z
  .object({
    taskId: z.string().min(1),
    runtime: AdapterRuntimeRoleSchema,
    toolCallId: z.string().min(1),
    toolName: z.string().min(1),
  })
  .strict()

const AdapterToolResultSuccessDetailSchema = AdapterToolResultDetailBaseSchema.extend({
  ok: z.literal(true),
  result: JsonObjectSchema,
  error: z.never().optional(),
}).strict()

const AdapterToolResultFailureDetailSchema = AdapterToolResultDetailBaseSchema.extend({
  ok: z.literal(false),
  error: z.string().min(1),
  result: z.never().optional(),
}).strict()

export const AdapterToolResultDetailSchema = z
  .discriminatedUnion('ok', [AdapterToolResultSuccessDetailSchema, AdapterToolResultFailureDetailSchema])
  .describe('Tool result detail with explicit success/failure payload branches.')

export const AdapterToolResultEventSchema = z
  .object({
    type: z.literal('tool_result'),
    detail: AdapterToolResultDetailSchema,
  })
  .strict()
  .describe('Tool result event carrying success or failure after tool execution.')

export type AdapterToolResultEvent = z.output<typeof AdapterToolResultEventSchema>

export const AdapterToolEventSchema = z
  .discriminatedUnion('type', [AdapterToolExecutionEventSchema, AdapterToolResultEventSchema])
  .describe('Adapter tool lifecycle events used by event-to-message mapping.')

export type AdapterToolEvent = z.output<typeof AdapterToolEventSchema>

export const AdapterToolEventJsonSchema = {
  oneOf: [AdapterToolExecutionEventJsonSchema, AdapterToolResultEventJsonSchema],
} as const
