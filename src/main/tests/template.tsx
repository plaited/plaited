import { bElement } from 'plaited'

export const DelegateFalse = bElement({
  tag: 'delegate-false',
  delegatesFocus: false,
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ModeOpen = bElement({
  tag: 'mode-open',
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ClosedMode = bElement({
  tag: 'mode-closed',
  mode: 'closed',
  shadowDom: <span>mode open and delegates focus</span>,
})
