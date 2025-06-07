import { defineElement } from 'plaited'

export const DelegateFalse = defineElement({
  tag: 'delegate-false',
  delegatesFocus: false,
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ModeOpen = defineElement({
  tag: 'mode-open',
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ClosedMode = defineElement({
  tag: 'mode-closed',
  mode: 'closed',
  shadowDom: <span>mode open and delegates focus</span>,
})
