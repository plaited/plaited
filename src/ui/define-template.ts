import type * as z from 'zod'
import { JsonObjectSchema } from '../shared.ts'
import { PLAITED_TEMPLATE_IDENTIFIER } from './template.constants.ts'
import type { FunctionTemplate } from './template.ts'
import type { Attrs, TemplateObject } from './template.types.ts'

type PlaitedTemplate<T extends Attrs> = FunctionTemplate<T> & {
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
  inputSchema: typeof JsonObjectSchema
}

export type DefineTemplate = <Schema extends typeof JsonObjectSchema>({
  template,
  inputSchema,
}: {
  inputSchema?: Schema
  template: FunctionTemplate<z.output<Schema>>
}) => PlaitedTemplate<z.output<Schema>>

export const defineTemplate: DefineTemplate = ({ template, inputSchema = JsonObjectSchema }) => {
  const toRet = (params: Parameters<typeof template>[0]): TemplateObject => {
    inputSchema?.parse(params.attrs ?? {})
    const tpl = template(params)
    return tpl
  }
  toRet.$ = PLAITED_TEMPLATE_IDENTIFIER
  toRet.inputSchema = inputSchema
  return toRet
}
