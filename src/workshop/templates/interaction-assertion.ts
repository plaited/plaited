import {  toId } from '../to-id.ts'
export const interactionAssertion = (name: string, title: string) => `await ${name}?.play({page, expect, id: ${toId(title, name)}})`
