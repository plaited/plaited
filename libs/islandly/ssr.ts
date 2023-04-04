import { Template } from './create-template.ts'
export const ssr = (...templates: Template[]) => {
  return '<!DOCTYPE html> ' + templates.map((tpl) => tpl.content).join('')
}
