import { Template } from './create-template.ts'
export const ssr = (...templates: Template[]) =>
  templates.map((tpl) => tpl.template).join(' ')
