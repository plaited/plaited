import * as z from 'zod'
import type { JsonObjectSchema } from '../shared/shared.schemas.ts'
import { PLAITED_TEMPLATE_IDENTIFIER, type SCALE, SCALE_RANK } from './template.constants.ts'
import { type FunctionTemplate, ScaleViolantionError } from './template.ts'
import type { TemplateObject } from './template.types.ts'

type PlaitedTemplate<Attrs extends z.output<typeof JsonObjectSchema>> = FunctionTemplate<Attrs> & {
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
  scale: keyof typeof SCALE
}

const EmptySchema = z.object({})

export type DefineTemplate = <Schema extends typeof JsonObjectSchema>({
  template,
  inputScehama,
  scale,
}: {
  inputScehama?: Schema
  template: FunctionTemplate<z.output<Schema>>
  scale: keyof typeof SCALE
}) => PlaitedTemplate<z.output<Schema>>

export const defineTemplate: DefineTemplate = ({ template, inputScehama = EmptySchema, scale }) => {
  const toRet = (params: Parameters<typeof template>[0]): TemplateObject => {
    inputScehama.parse(params?.attrs ?? {})
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
