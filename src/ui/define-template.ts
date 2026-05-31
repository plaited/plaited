import * as z from 'zod'
import { PLAITED_TEMPLATE_IDENTIFIER, type SCALE, SCALE_RANK } from './template.constants.ts'
import { type FunctionTemplate, ScaleViolantionError } from './template.ts'
import type { TemplateObject } from './template.types.ts'

type PlaitedTemplate<Attrs extends Record<string, unknown>> = FunctionTemplate<Attrs> & {
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
  scale: keyof typeof SCALE
}

const EmptySchema = z.object({})

export type DefineTemplate = <Schema extends z.ZodType<Record<string, unknown>>>({
  template,
  inputSchema,
  scale,
}: {
  inputSchema?: Schema
  template: FunctionTemplate<z.output<Schema>>
  scale: keyof typeof SCALE
}) => PlaitedTemplate<z.output<Schema>>

export const defineTemplate: DefineTemplate = ({ template, inputSchema = EmptySchema, scale }) => {
  const toRet = (params: Parameters<typeof template>[0]): TemplateObject => {
    inputSchema.parse(params?.attrs ?? {})
    const tpl = template(params)
    if (SCALE_RANK[tpl.scale] > SCALE_RANK[scale]) {
      throw new ScaleViolantionError(
        `Cannot nest higher structural order element (${tpl.scale}) inside a lower structural boundary container (${scale}).`,
      )
    }
    return tpl
  }
  toRet.$ = PLAITED_TEMPLATE_IDENTIFIER
  toRet.scale = scale
  return toRet
}
