import { PlaitedElement } from './create-template.ts'
export const ssr = (...templates: PlaitedElement[]) =>
  templates.map((tpl) => tpl() as string).join(' ')
