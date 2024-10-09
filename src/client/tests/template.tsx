import { defineTemplate } from '../../client/define-template.ts'

export const DelegateFalse = defineTemplate({
  tag: 'delegate-false',
  delegatesFocus: false,
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ModeOpen = defineTemplate({
  tag: 'mode-open',
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ClosedMode = defineTemplate({
  tag: 'mode-closed',
  mode: 'closed',
  shadowDom: <span>mode open and delegates focus</span>,
})
