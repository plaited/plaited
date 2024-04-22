import { TemplateObject } from 'plaited'

export type ModuleHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T,
) => Promise<TemplateObject>

export type ComponentMap = Map<
  string,
  {
    path: string
    name: string
  }
>
